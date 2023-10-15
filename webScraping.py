import requests
import json
import pandas as pd
from bs4 import BeautifulSoup

url = "https://volcano.si.edu/volcanolist_countries.cfm"
html = requests.get(url).content
soup = BeautifulSoup(html, "html.parser")
table = soup.find("div", {"class": "TableSearchResults"})

rows = table.find_all("tr")
informacoes = []

def get_vulcao_coordinates(nome_vulcao):
    # URL da API do OpenStreetMap para pesquisa
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={nome_vulcao}"

    # Faz a requisição à API
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        if data:
            # Assume que o primeiro resultado é o mais relevante
            lat = data[0]['lat']
            lon = data[0]['lon']
            return float(lat), float(lon)
        else:
            return None
    else:
        print("Falha na requisição. Código de status:", response.status_code)
        return None


for item in rows:
    entries = item.find_all("td")

    if entries:
        first = entries[0].get_text()
        last_entry = entries[-1].get_text()
        last_entry_list = last_entry.split(',')

        if "" not in last_entry_list:
            for vulcao in last_entry_list:

                nova_informacao = {'Pais': first, 'Vulcao': vulcao.strip(),
                                   'Coordenada': get_vulcao_coordinates(vulcao.strip())}
                informacoes.append(nova_informacao)


nome_vulcaodata_vulcoes = pd.DataFrame(informacoes)

print(nome_vulcaodata_vulcoes)

nome_vulcaodata_vulcoes.to_json('vulcoes.json', orient='records', lines=True)
