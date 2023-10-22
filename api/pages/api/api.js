
// Função final da api --------------------------------------------------------
async function run(LAT, LON, dataPassada, dataAtual) {
  try {
    const args_uv = {
      'Content-Type': 'application/json',
      'x-access-token': 'openuv-key-io'
    };
    const urlVulcoes = "https://raw.githubusercontent.com/AnaArantesBarros/GeosenseAPI/main/vulcoes.json";
    const args_nasa = "PRECTOT,T2M,T2M_MAX,T2M_MIN";
    const urlAltitude = [
      `https://api.opentopodata.org/v1/srtm30m?locations=${LAT},${LON}`,
      `https://api.opentopodata.org/v1/srtm30m?locations=${LAT},${LON + 0.001}`
    ];
    const vulcoes = await obterTitulosEventos(urlVulcoes);

    var status = [];

    for (var vulcao in vulcoes) {
      const vulcaoData = vulcoes[vulcao];
      const coord = vulcaoData.Coordenada;
      var status = estaDentroDaDistancia(coord, [LAT, LON]);
    }

    const altitudesPromises = urlAltitude.map(getAltitude);
    const altitudes = await Promise.all(altitudesPromises);
    const nasaData = await nasa(dataPassada, dataAtual, LAT, LON, args_nasa);
    const terrain = slope(altitudes);
    const earthquakes = await fetchAndCountEarthquakes(LAT, LON);
    const uv = await getUv(args_uv, LAT, LON)
    const high_uv_radiation = (uv >= 6)

    const fadi = FADI_calc(parseInt(nasaData.T2M, 10),
      parseInt(nasaData.TMAX, 10),
      parseInt(nasaData.TMIN, 10),
      parseInt(nasaData.PRECTOT, 10),
      parseInt(uv, 10),
      parseInt(terrain, 10),
      parseInt(earthquakes['Magnitude < 4:'], 10) +
      parseInt(earthquakes['Magnitude 4-6:'], 10) +
      parseInt(earthquakes['Magnitude > 6:'], 10),
      parseInt(earthquakes['Magnitude < 4:'], 10),
      parseInt(earthquakes['Magnitude 4-6:'], 10),
      parseInt(earthquakes['Magnitude > 6:'], 10)
    );

    const resultado = {
      "FADI": fadi,
      "temperature": {
        "low_temperatures": nasaData.TMIN < 0,
        "high_temperatures": nasaData.TMAX > 30,
        "temp_info": `Mean temperature of ${nasaData.TMAX} Degrees Celsius, you may be exposed to thermic stress`
      },
      "radiation": {
        "high_uv_radiation": high_uv_radiation,
        "radiation_info": "High UV incidence, watch out for sunburns"
      },
      "rain": {
        "heavy_rain": nasaData.PRECTOT > 150,
        "rain_info": `Mean Precipitation of ${nasaData.PRECTOT} mm/h can make field activities difficult`
      },
      "terrain": {
        "steep_terrain": terrain > 20,
        "terrain_info": `Terrain Slope of ${terrain} % can make it difficult to walk or climb`
      },
      "volcan": {
        "volcanic_activity": status,
        "volcanic_info": "Active Volcanoes may be a threat to your activities"
      },
      "earthquake": {
        "earthquakes": earthquakes.status,
        "earthquake_info": "Earthquakes may be a danger in this area"
      }
    }
    console.log(resultado);
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

async function fetchAndCountEarthquakes(v1,v2) {
  const baseUrl = 'https://www.seismicportal.eu/testimonies-ws/api/search';
  const params = {
    lat: v1,
    lon: v2,
    maxradius: 1,
    minnbtestimonies: 500,
    format: 'text',
  };

  // Construa a URL com os parâmetros
  const url = new URL(baseUrl);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

  try {
    // Faça a solicitação usando fetch
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Erro na solicitação HTTP: ' + response.status);
    }

    // Retorna os dados da resposta
    const data = await response.text();

    // Função para contar terremotos com base no número de relatos
    function contarTerremotos(data) {
      const linhas = data.trim().split('\n'); // Dividir os dados em linhas, removendo espaços em branco no início e no final
      const df = [];

      for (const linha of linhas) {
        if (!linha.startsWith('#')) { // Ignorar linhas de cabeçalho iniciadas com #
          const partes = linha.split('|'); // Dividir os dados em partes

          if (partes.length >= 9) {
            const entry = {
              'data': partes[1],
              'lat': parseFloat(partes[2], 10),
              'lon': parseFloat(partes[3], 10),
              'mag': parseFloat(partes[5], 10),
            };
            df.push(entry);
          }
        }
      }

      return df;
    }

    // Função para contar terremotos por magnitude
    function contarTerremotosPorMagnitude(df) {
      let countMagnitude0to4 = 0;
      let countMagnitude4to6 = 0;
      let countMagnitudeAbove6 = 0;

      for (const entry of df) {
        const magnitude = entry.mag;

        // Verifique se a entrada é de 2023
        if (entry.data.startsWith('2023')) {
          if (magnitude < 4) {
            countMagnitude0to4++;
          } else if (magnitude >= 4 && magnitude < 6) {
            countMagnitude4to6++;
          } else {
            countMagnitudeAbove6++;
          }
        }
      }

      return {
        countMagnitude0to4,
        countMagnitude4to6,
        countMagnitudeAbove6,
      };
    }

    const df = contarTerremotos(data);
    const contagemPorMagnitude = contarTerremotosPorMagnitude(df);
    const todasSaoZero = contagemPorMagnitude.countMagnitude0to4 === 0 && contagemPorMagnitude.countMagnitude4to6 === 0 && contagemPorMagnitude.countMagnitudeAbove6 === 0;

    const dict = {
      "status": todasSaoZero,
      "Magnitude < 4:": contagemPorMagnitude.countMagnitude0to4,
      "Magnitude 4-6:": contagemPorMagnitude.countMagnitude4to6,
      "Magnitude > 6:": contagemPorMagnitude.countMagnitudeAbove6
    };
    return dict
    
  } catch (error) {
    console.error(error);
  }
}
function getA(temperaturaMedia) {
  const faixas = [
    [-50, -15, 8],
    [-15, -2, 6],
    [-2, 10, 4],
    [10, 16, 2],
    [16, 26, 0],
    [26, 30, 2],
    [30, 34, 4],
    [34, 40, 6],
    [40, 51, 8]
  ];

  for (const faixa of faixas) {
    if (temperaturaMedia >= faixa[0] && temperaturaMedia < faixa[1]) {
      return faixa[2];
    }
  }

  return null;
}

function getB(tmax, tmin) {
  const temperaturaVariacao = Math.abs(parseInt(tmax) - parseInt(tmin));
  const faixas = [
    [0, 5, 0],
    [5, 11, 1],
    [11, 17, 2],
    [17, 23, 3],
    [23, 29, 4],
    [29, 35, 5],
    [35, 41, 6],
    [41, 61, 7]
  ];

  for (const faixa of faixas) {
    if (temperaturaVariacao >= faixa[0] && temperaturaVariacao < faixa[1]) {
      return faixa[2];
    }
  }

  return null;
}


function getC(precipitacao) {
  const faixas = [
    [0, 40, 0],
    [40, 110, 2],
    [110, 180, 4],
    [180, 1000, 6]
  ];

  for (const faixa of faixas) {
    if (precipitacao >= faixa[0] && precipitacao < faixa[1]) {
      return faixa[2];
    }
  }

  return null;
}


function getD(radiacaoUv) {
  const listaRadiacao = [
    [0, 2, 0],
    [2, 5, 1],
    [5, 7, 2],
    [7, 10, 3],
    [10, 21, 4]
  ];

  for (const faixa of listaRadiacao) {
    if (radiacaoUv >= faixa[0] && radiacaoUv < faixa[1]) {
      return faixa[2];
    }
  }

  return null;
}


function getE(inclinacaoTerreno) {
  const inclTerreno = [
    [0, 5, 0.0],
    [5, 10, 0.3],
    [10, 20, 0.6],
    [20, 30, 0.9],
    [30, 45, 1.2],
    [45, 91, 1.5]
  ];

  if (inclinacaoTerreno === 'null') {
    return 0.6;
  }

  for (const faixa of inclTerreno) {
    if (inclinacaoTerreno >= faixa[0] && inclinacaoTerreno < faixa[1]) {
      return faixa[2];
    }
  }

  return null;
}


function getF(vulcoesAtivos) {
  return vulcoesAtivos === 0 ? 0 : vulcoesAtivos > 0 ? 2 : undefined;
}

function getG(terremotosLeves) {
  if (terremotosLeves === 0) {
    return 0;
  } else if (terremotosLeves > 0 && terremotosLeves <= 5) {
    return 1;
  } else if (terremotosLeves > 5 && terremotosLeves <= 10) {
    return 2;
  } else if (terremotosLeves > 10) {
    return 3;
  }
}

function getH(terremotosMedio) {
  if (terremotosMedio === 0) {
    return 0;
  } else if (terremotosMedio > 0 && terremotosMedio <= 2) {
    return 1;
  } else if (terremotosMedio > 2 && terremotosMedio <= 5) {
    return 2;
  }
}

function getI(terremotosPesados) {
  if (terremotosPesados === 0) {
    return 0;
  } else if (terremotosPesados === 1) {
    return 1;
  } else {
    return 2;
  }
}


function FADI_calc(tmed, tmax, tmin, precipitacao, radiacaoUv, inclinacaoTerreno, vulcoesAtivos, terremotosLeves, terremotosMedio, terremotosPesados) {
  const A = getA(tmed);
  const B = getB(tmax, tmin);
  const C = getC(precipitacao);
  const D = getD(radiacaoUv);
  const E = getE(inclinacaoTerreno);
  const F = getF(vulcoesAtivos);
  const G = getG(terremotosLeves);
  const H = getH(terremotosMedio);
  const I = getI(terremotosPesados);

  if (A === null || B === null || C === null || D === null || E === null || F === null || G === null || H === null || I === null) {
    return 'Argumentos inválidos';
  }

  const index_tempo = (((5 * A) + (2 * B) + (5 * C) + (3 * D)) / 15);
  const geological_index = (((8 * F) + (2 * G) + (4 * H) + (6 * I)) / 20);
  const terrain_index = E;

  const result = (index_tempo + geological_index + terrain_index).toFixed(3);
  return parseFloat(result);
}
