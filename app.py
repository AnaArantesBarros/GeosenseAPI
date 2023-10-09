from flask import Flask, request, jsonify
import datetime
from datetime import timedelta
import pandas as pd
import statistics
import requests as rq
import json
import math

app = Flask(__name__)

# Pegar última data disponível e data 30 dias atrás
d = datetime.datetime.today() - timedelta(days=35)
data_inicial = d.strftime('%Y%m%d')

d4 = datetime.datetime.today() - timedelta(days=5)
data_final = d4.strftime('%Y%m%d')

# Funções APIS====================================================
def nasa(data_inicio, data_fim, lat, lon,
         args="PRECTOT,T2M,T2M_MAX,T2M_MIN,RH2M,ALLSKY_SFC_UVA"):
    solicitacao = rq.get(
        "https://power.larc.nasa.gov/api/temporal/daily/point?start=" + data_inicio + "&end=" + data_fim + "&latitude=" + str(
            lat) + "&longitude=" + str(lon) + "&community=sb&parameters=" + args + "&format=csv&header=true")
    response = solicitacao.status_code
    print("Status Code: {}".format(response))

    data = solicitacao.text

    # Limpamos as informações desnecessárias
    before, sep, after = data.partition("-END HEADER-")
    if len(after) > 0:
        data = after

        df = pd.DataFrame([x.split(',') for x in data.split('\n')[2:]],
                          columns=[x for x in data.split('\n')[1].split(',')])

        return df

# Função API UV ==================================================================================

def get_uv(args, LAT, LON):
    url = f'https://api.openuv.io/api/v1/uv?lat={LAT}&lng={LON}'
    try:
        response = rq.get(url, headers=args)
        data = response.json()
        return data  # Retorna os dados em vez de imprimir
    except rq.exceptions.RequestException as err:
        print(err)


def get_altitude(api_url):
    response = rq.get(api_url)

    if response.status_code == 200:
        data = response.json()
        return data
    else:
        print("Erro ao fazer a requisição:", response.status_code)
        return None

args_uv = {
    'Content-Type': 'application/json',
    'x-access-token': 'MY_KEY'
}

def obter_titulos_eventos(api_url):
    response = rq.get(api_url)

    if response.status_code == 200:
        data = response.json()
        return data
    else:
        print("Erro ao fazer a requisição:", response.status_code)
        return None

def esta_dentro_da_distancia(coord1, coord2, distancia_max_km=10):
    # Coordenadas no formato (latitude, longitude)
    lat1, lon1 = coord1
    lat2, lon2 = coord2

    # Raio da Terra em km
    raio_terra_km = 6371.0

    # Converter coordenadas de graus para radianos
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    # Diferença das longitudes
    delta_lon = lon2_rad - lon1_rad

    # Fórmula de Haversine
    a = math.sin((lat2_rad - lat1_rad) / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Distância em quilômetros
    distancia_km = raio_terra_km * c

    # Verifica se a distância está dentro do limite máximo (10 km)
    return distancia_km <= distancia_max_km

api_vulcao = "https://eonet.gsfc.nasa.gov/api/v2.1/events"

def contar_terremotos_por_magnitude(latitude, longitude, raio_km):
    url = "https://earthquake.usgs.gov/fdsnws/event/1/query"

    params = {
        "format": "geojson",
        "latitude": latitude,
        "longitude": longitude,
        "maxradiuskm": raio_km
    }

    response = rq.get(url, params=params)

    if response.status_code == 200:
        data = response.json()
        # Initialize counters for different magnitude ranges
        count_magnitude_0_to_4 = 0
        count_magnitude_4_to_6 = 0
        count_magnitude_above_6 = 0

        for event in data["features"]:
            magnitude = float(event["properties"]["mag"])
            if 0 <= magnitude < 4:
                count_magnitude_0_to_4 += 1
            elif 4 <= magnitude < 6:
                count_magnitude_4_to_6 += 1
            elif magnitude >= 6:
                count_magnitude_above_6 += 1

        return count_magnitude_0_to_4, count_magnitude_4_to_6, count_magnitude_above_6
    else:
        print("Erro ao fazer a requisição:", response.status_code)
        return None, None, None

raio_km = 10  # Exemplo de raio em km
# Funções pesos===================================================
def get_A(temperatura_media):
    lista_temperatura_media = [(i, 8) for i in range(-50, -15)] + \
                              [(i, 6) for i in range(-15, -2)] + \
                              [(i, 4) for i in range(-2, 10)] + \
                              [(i, 2) for i in range(10, 16)] + \
                              [(i, 0) for i in range(16, 26)] + \
                              [(i, 2) for i in range(26, 30)] + \
                              [(i, 4) for i in range(30, 34)] + \
                              [(i, 6) for i in range(34, 40)] + \
                              [(i, 8) for i in range(40, 51)]
    temp_media_df = pd.DataFrame(lista_temperatura_media, columns=['indice', 'valor'])
    A = temp_media_df.loc[temp_media_df['indice'] == temperatura_media, 'valor'].values[0]
    return A


def get_B(tmax,tmin):
    temperatura_variacao = abs(int(tmax)-int(tmin))
    lista_temperatura_varia = [(i, 0) for i in range(0, 5)] + \
                              [(i, 1) for i in range(5, 11)] + \
                              [(i, 2) for i in range(11, 17)] + \
                              [(i, 3) for i in range(17, 23)] + \
                              [(i, 4) for i in range(23, 29)] + \
                              [(i, 5) for i in range(29, 35)] + \
                              [(i, 6) for i in range(35, 41)] + \
                              [(i, 7) for i in range(41, 61)]
    temp_varia_df = pd.DataFrame(lista_temperatura_varia, columns=['indice', 'valor'])
    B = temp_varia_df.loc[temp_varia_df['indice'] == temperatura_variacao, 'valor'].values[0]
    return B


def get_C(precipitacao):
    lista_precipitacao = [(i, 0) for i in range(0, 40)] + \
                              [(i, 2) for i in range(40, 110)] + \
                              [(i, 4) for i in range(110, 180)] + \
                              [(i, 6) for i in range(180, 1000)]
    precipita = pd.DataFrame(lista_precipitacao, columns=['indice', 'valor'])
    C = precipita.loc[precipita['indice'] == precipitacao, 'valor'].values[0]
    return C


def get_D(radiacao_uv):
    lista_radiacao = [(i, 0) for i in range(0, 2)] + \
                     [(i, 1) for i in range(2, 5)] + \
                     [(i, 2) for i in range(5, 7)] + \
                     [(i, 3) for i in range(7, 10)] + \
                     [(i, 4) for i in range(10, 21)]
    radiacao_df = pd.DataFrame(lista_radiacao, columns=['indice', 'valor'])
    D = radiacao_df.loc[radiacao_df['indice'] == radiacao_uv, 'valor'].values[0]
    return D


def get_E(inclinacao_terreno):
    inc_terreno = [(i, 0.0) for i in range(0, 5)] + \
                  [(i, 0.3) for i in range(5, 10)] + \
                  [(i, 0.6) for i in range(10, 20)] + \
                  [(i, 0.9) for i in range(20, 30)] + \
                  [(i, 1.2) for i in range(30, 45)] + \
                  [(i, 1.5) for i in range(45, 91)]
    inc_terreno_df = pd.DataFrame(inc_terreno, columns=['indice', 'valor'])
    if inclinacao_terreno == 'null':
        E = 0.6
    else:
        E = inc_terreno_df.loc[inc_terreno_df['indice'] == inclinacao_terreno, 'valor'].values[0]
    return E


def get_F(vulcoes_ativos):
    if vulcoes_ativos == 0:
        F = 0
    elif vulcoes_ativos > 0:
        F = 2
    return F


def get_G(terremotos_leve):
    if terremotos_leve == 0:
        G = 0
    elif terremotos_leve > 0 and terremotos_leve <= 5:
        G = 1
    elif terremotos_leve > 5 and terremotos_leve <= 10:
        G = 2
    elif terremotos_leve > 10:
        G = 3
    return G


def get_H(terremotos_medio):
    if terremotos_medio == 0:
        H = 0
    elif terremotos_medio > 0 and terremotos_medio <= 2:
        H = 1
    elif terremotos_medio > 2 and terremotos_medio <= 5:
        H = 2
    return H


def get_I(terremotos_pesado):
    if terremotos_pesado == 0:
        I = 0
    elif terremotos_pesado == 1:
        I = 1
    elif terremotos_pesado > 1:
        I = 2
    return I




@app.route('/api/values', methods=['GET'])
def get_values_endpoint():
    # Get latitude and longitude from the query parameters
    latitude = float(request.args.get('lat'))
    longitude = float(request.args.get('lon'))

    # Chamada à função nasa ==================================
    dados_nasa = nasa(data_inicial, data_final, latitude,
                      longitude,
                      "PRECTOT,T2M,T2M_MAX,T2M_MIN,ALLSKY_SFC_UVA")
    dados_nasa = dados_nasa.dropna()
    # Formatando dados
    # Pegando resumo de cada coluna

    tmean = statistics.mean(pd.to_numeric(dados_nasa['T2M']))
    A = get_A(int(tmean))
    tmax = max(pd.to_numeric(dados_nasa['T2M_MAX']))
    tmin = min(pd.to_numeric(dados_nasa['T2M_MIN']))
    B = get_B(tmax,tmin)
    prec = sum(pd.to_numeric(dados_nasa['PRECTOTCORR']))
    C = get_C(int(prec))

    # Chamada à função uv =======================================
    dados_uv = get_uv(args_uv, latitude, longitude)

    # Verifica se os dados são válidos
    if dados_uv and 'result' in dados_uv:
        uv_max = dados_uv['result'].get('uv_max', 0)
    else:
        uv_max = 0

    D = get_D(int(uv_max))


    # Chamada à slope =======================================
    url_altitude = f'https://api.opentopodata.org/v1/srtm30m?locations={latitude},{longitude}'
    url_altitude1 = f'https://api.opentopodata.org/v1/srtm30m?locations={latitude},{longitude + 0.001}'
    altitude = get_altitude(url_altitude)
    altitude1 = get_altitude(url_altitude1)

    delta_elev = abs(altitude['results'][0]['elevation'] - altitude1['results'][0]['elevation'])
    slope = ((delta_elev / 111.32) * 100)
    E = get_E(int(slope))

    # Chamada à vulcoes ======================================
    # Obter informações sobre eventos (incluindo vulcões) usando a API da NASA EONET
    informacoes_eventos = obter_titulos_eventos(api_vulcao)

    # Exibir todos os títulos e colunas dos eventos
    if informacoes_eventos:
        # Extrai os dados dos eventos
        eventos = informacoes_eventos["events"]

        # Criar listas para os dados
        titulos = []
        categorias = []
        pontos = []

        for evento in eventos:
            # Título do evento
            titulos.append(evento['title'])

            # Categoria do evento (vulcão)
            categorias.append(evento['categories'][0]['title'])

            # Coordenadas do evento (assumindo que é o primeiro conjunto de coordenadas)
            pontos.append(evento['geometries'][0]['coordinates'])

        # Criação do DataFrame
        vulcoes = pd.DataFrame({
            'titulo': titulos,
            'categoria': categorias,
            'ponto': pontos
        })
    # Coordenadas de referência (exemplo)
    coord_referencia = [latitude, longitude]  # Coordenadas fornecidas

    # Coordenadas das observações (exemplo)
    coord_observacoes = vulcoes['ponto']  # Exemplo de observação fora dos 10 km

    for obs in coord_observacoes:
        dentro_de_10km = esta_dentro_da_distancia(coord_referencia, obs)
        if dentro_de_10km == True:
            vulcao = True
        else:
            vulcao = False
    F = vulcao

    # Chamada à terremotos ======================================
    raio_km = 10  # Example radius in km

    # Count earthquakes in different magnitude ranges
    count_0_to_4, count_4_to_6, count_above_6 = contar_terremotos_por_magnitude(latitude, longitude, raio_km)


    G = get_G(count_0_to_4)
    H = get_H(count_4_to_6)
    I = get_I(count_above_6)
    # Cálculo FADI
    wheather_index = ((5 * int(A)) + (2 * int(B)) + (5 * int(C)) + (3 * int(D))) / 15
    geological_index = ((8 * int(F)) + (2 * int(G)) + (4 * int(H)) + (6 * int(I))) / 20
    terrain_index = E

    FADI_index = "{:.3f}".format(wheather_index + geological_index + terrain_index)

    # Definindo parametros
    low_temperatures = True if tmin < 0 else False
    high_temperatures = True if tmax > 30 else False
    high_uv_radiation = True if uv_max >= 6 else False
    temp_info = "Mean temperature of -3 Degres Celsius, extreme cold may be a risk" if low_temperatures else "Mean temperature of 36 Degres Celsius, you may be exposed to thermic stress" if high_temperatures else "Temperature is within a comfortable range"
    heavy_rain = True if prec > 150 else False
    steep_terrain = True if slope > 20 else False
    volcanic_activity = True if vulcao >= 1 else False
    earthquakes = True if count_0_to_4 > 8 else True if count_4_to_6 > 2 else True if count_above_6 > 0 else False
    # Criando um dicionário com os dados
    result = {
        "FADI": FADI_index,
        "temperature": {
            "low_temperatures": low_temperatures,
            "high_temperatures": high_temperatures,
            "temp_info": temp_info
        },
        "radiation": {
            "high_uv_radiation": high_uv_radiation,
            "radiation_info": "High UV incidence, watch out for sunburns"
        },
        "rain": {
            "heavy_rain": heavy_rain,
            "rain_info": f"Mean Precipitation of {prec} mm/h can make field activities difficult"
        },
        "terrain": {
            "steep_terrain": steep_terrain,
            "terrain_info": f"Terrain Slope of {slope:.2f}% can make it difficult to walk or climb"
        },
        "volcan": {
            "volcanic_activity": volcanic_activity,
            "volcanic_info": "Active Volcanoes may be a threat to your activities"
        },
        "earthquake": {
            "earthquakes": earthquakes,
            "earthquake_info": "Earthquakes of 5 degrees on the Richter scale occur frequently in the last year, which may be a danger in this area"
        }
    }

    return jsonify(result)


if __name__ == '__main__':
    app.run(debug=True)
