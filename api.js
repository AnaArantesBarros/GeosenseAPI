
const LAT = -23.5505;  // Latitude para São Paulo (negativa)
const LON = -46.6333;  // Longitude para São Paulo (negativa)
const dataAtual = "20231005";
const dataPassada = "20230905";

// Função final da api --------------------------------------------------------
async function run() {
  try {
    const args_uv = {
      'Content-Type': 'application/json',
      'x-access-token': 'openuv-key-io'
    };
    const urlVulcoes = "https://raw.githubusercontent.com/AnaArantesBarros/GeosenseAPI/main/vulcoes.json";
    const args_nasa = "PRECTOT,T2M,T2M_MAX,T2M_MIN";
    const urlAltitude = [`https://api.opentopodata.org/v1/srtm30m?locations=${LAT},${LON}`,`https://api.opentopodata.org/v1/srtm30m?locations=${LAT},${LON + 0.001}`];
    const vulcoes = await obterTitulosEventos(urlVulcoes);
    var coordenadas = [];
    var status = [];

    for (var vulcao in vulcoes) {
      const vulcaoData = vulcoes[vulcao];
      const coord = vulcaoData.Coordenada;
      //const nomedovulcao = vulcaoData.Vulcao;  
      var status = estaDentroDaDistancia(coord, [LAT, LON]);
    }
    const altitudesPromises = urlAltitude.map(getAltitude);
    const altitudes = await Promise.all(altitudesPromises);
    const nasaData = await nasa(dataPassada, dataAtual, LAT, LON, args_nasa);
    console.log(nasaData,slope(altitudes),status);
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

// Funções básicas ------------------------------------------------------------
function mean(arr) {
  if (arr.length === 0) return 0;

  const sum = arr.reduce((acc, value) => acc + value, 0);
  return sum / arr.length;
}

function sum(arr) {
  if (!arr || arr.length === 0) return 0;

  return arr.reduce((acc, value) => acc + value, 0);
}


// Funções pegando informações de outras api's --------------------------------
// Função api UV
async function getUv(args, LAT, LON) { // limite de 50 requisições por dia
  const url = `https://api.openuv.io/api/v1/uv?lat=${LAT}&lng=${LON}`;
  try {
    const response = await fetch(url, { 
      headers: {
        'Content-Type': args['Content-Type'],
        'x-access-token': args['x-access-token']
      }
    });
    if (!response.ok) {
      throw new Error('Erro ao obter dados de UV');
    }
    const data = await response.json();
    return data.result.uv_max.toFixed(2);
  } catch (error) {
    throw new Error(`Erro na requisição de UV: ${error.message}`);
  }
}

// Função api nasa
async function nasa(data_inicio, data_fim, lat, lon, args) {
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?start=${data_inicio}&end=${data_fim}&latitude=${lat}&longitude=${lon}&community=sb&parameters=${args}&format=JSON`;
  try {
    const response = await fetch(url, { 
      headers: {
        'Content-Type': 'application/json'
      }
    });


    if (!response.ok) { // "PRECTOT,T2M,T2M_MAX,T2M_MIN,RH2M,ALLSKY_SFC_UVA"
      throw new Error('Erro ao obter dados da NASA');
    }
    const data = await response.json();
    var TMIN = data.properties.parameter.T2M_MIN;
    var TMIN = Object.keys(TMIN).map(function(_) { return TMIN[_]; });
    var TMIN = Math.min(...TMIN);

    var TMAX = data.properties.parameter.T2M_MAX;
    var TMAX = Object.values(TMAX);
    var TMAX = Math.max(...TMAX);

    var PRECTOT = data.properties.parameter.PRECTOTCORR;
    var PRECTOT = Object.keys(PRECTOT).map(function(_) { return PRECTOT[_]; });
    var PRECTOT = sum(PRECTOT);

    var T2M = data.properties.parameter.T2M;
    var T2M = Object.keys(T2M).map(function(_) { return T2M[_]; });
    var T2M = mean(T2M);

    return {
      TMIN: TMIN.toFixed(2),
      TMAX: TMAX.toFixed(2),
      PRECTOT: PRECTOT.toFixed(2),
      T2M: T2M.toFixed(2)
    };
  } catch (error) {
    throw new Error(`Erro na requisição da NASA: ${error.message}`);
  }
}


// Funções para cálculo do slope
async function getAltitude(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Erro ao obter altitude');
    }
    const data = await response.json();
    return data.results[0].elevation;
  } catch (error) {
    throw new Error(`Erro na requisição de UV: ${error.message}`);
  }
}

function slope(altitudes) {
  const deltaElevation = altitudes[0] - altitudes[1]
  const slope = (deltaElevation/ 111.32) * 100
  return Math.abs(slope.toFixed(2))
}

// Função para verificar vulcões próximos
async function obterTitulosEventos(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Erro ao obter dados de vulcoes');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Erro na requisição de vulcoes: ${error.message}`);
  }
}

function estaDentroDaDistancia(coord1, coord2, distanciaMaxKm = 10) {
  // Coordenadas no formato (latitude, longitude)
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;

  // Raio da Terra em km
  const raioTerraKm = 6371.0;

  // Converter coordenadas de graus para radianos
  const lat1Rad = toRadians(lat1);
  const lon1Rad = toRadians(lon1);
  const lat2Rad = toRadians(lat2);
  const lon2Rad = toRadians(lon2);

  // Diferença das longitudes
  const deltaLon = lon2Rad - lon1Rad;

  // Fórmula de Haversine
  const a = Math.sin((lat2Rad - lat1Rad) / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Distância em quilômetros
  const distanciaKm = raioTerraKm * c;

  // Verifica se a distância está dentro do limite máximo (10 km)
  return distanciaKm <= distanciaMaxKm;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

run(); // Chama a função para executar o código assíncrono
