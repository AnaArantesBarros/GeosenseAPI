// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { RequestInfo } from 'undici-types';


// Função zfill
function zfill(numero: number, largura: number) {
  const numeroString = numero.toString();
  const zerosFaltando = largura - numeroString.length;

  if (zerosFaltando > 0) {
    return "0".repeat(zerosFaltando) + numeroString;
  } else {
    return numeroString;
  }
}

// Obtém a data de hoje e a de 35 dias atrás
const dataDeHoje = new Date();
const dataAntes = new Date();
dataAntes.setDate(dataDeHoje.getDate() - 35);
dataDeHoje.setDate(dataDeHoje.getDate() - 5);

const data_antes = String(zfill(dataAntes.getFullYear(),4)+zfill(dataAntes.getMonth() + 1,2)+zfill(dataAntes.getDate(),2))
const data_hoje = String(zfill(dataDeHoje.getFullYear(),4)+zfill(dataDeHoje.getMonth() + 1,2)+zfill(dataDeHoje.getDate(),2))

// Retorno da API
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { LATLON } = req.query;
  const LAT = parseFloat(String(LATLON).split(",")[0]);
  const LON = parseFloat(String(LATLON).split(",")[1]);
  const resposta_run = await run(LAT, LON, data_antes, data_hoje);
  //console.log(resposta_run);
  //return resposta_run
  const jsonFormatted = JSON.stringify(resposta_run, null, 2);

  res.status(200).json(resposta_run);
}

//run(LAT, LON, dataPassada, dataAtual); // Chama a função para executar o código assíncrono


// Função final da api --------------------------------------------------------
async function run(LAT: number, LON:  number, dataPassada: string, dataAtual: string) {
  try {
    const args_uv = {
      'Content-Type': 'application/json',
      'x-access-token': 'openuv-11ntv7rlnfbhz2x-io'
    };
    const urlVulcoes = "https://raw.githubusercontent.com/AnaArantesBarros/GeosenseAPI/main/vulcoes.json";
    const args_nasa = "PRECTOT,T2M,T2M_MAX,T2M_MIN";
    const urlAltitude = [
      `https://api.opentopodata.org/v1/srtm30m?locations=${LAT},${LON}`,
      `https://api.opentopodata.org/v1/srtm30m?locations=${LAT},${LON + 0.001}`
    ];
    const vulcoes = await obterTitulosEventos(urlVulcoes);
    
    let status: any[] = []; // Declare status fora do loop

    for (var vulcao in vulcoes) {
    const vulcaoData = vulcoes[vulcao];
    const coord = vulcaoData.Coordenada;
    const estaDentro = estaDentroDaDistancia(coord, [LAT, LON]);
    status.push(estaDentro)
    //dataVulcoes.push()
    }
    
    const altitudesPromises = urlAltitude.map(getAltitude);
    const altitudes = await Promise.all(altitudesPromises);
    const nasaData = await nasa(dataPassada, dataAtual, LAT, LON, args_nasa);
    const terrain = slope(altitudes);
    const earthquakes = await fetchAndCountEarthquakes(LAT, LON);
    const uv = await getUv(args_uv, LAT, LON);
    const high_uv_radiation = (uv >= 6);
    const containsTrue = String(status).includes('true');
    const result = containsTrue ? 1 : 0;

    const fadi = FADI_calc(
      parseFloat(nasaData.T2M), 
      parseFloat(nasaData.TMAX), 
      parseFloat(nasaData.TMIN),
      parseFloat(nasaData.PRECTOT),
      parseFloat(uv),
      terrain,
      result,
      earthquakes?.['Magnitude < 4:'] || 0,
      earthquakes?.['Magnitude 4-6:'] || 0,
      earthquakes?.['Magnitude > 6:'] || 0
    );

    const resultado = {
      "FADI": fadi,
      "temperature": {
        "low_temperatures": parseInt(nasaData.TMIN) < 0,
        "high_temperatures": parseInt(nasaData.TMAX) > 30,
        "temp_info": `Mean temperature of ${nasaData.T2M} Degrees Celsius, you may be exposed to thermic stress`
      },
      "radiation": {
        "high_uv_radiation": high_uv_radiation,
        "radiation_info": "High UV incidence, watch out for sunburns"
      },
      "rain": {
        "heavy_rain": parseInt(nasaData.PRECTOT) > 150,
        "rain_info": `Mean Precipitation of ${nasaData.PRECTOT} mm/h can make field activities difficult`
      },
      "terrain": {
        "steep_terrain": terrain > 20,
        "terrain_info": `Terrain Slope of ${terrain.toFixed(2)} % can make it difficult to walk or climb`
      },
      "volcan": {
        "volcanic_activity": containsTrue,
        "volcanic_info": "Active Volcanoes may be a threat to your activities"
      },
      "earthquake": {
        "earthquakes": earthquakes,
        "earthquake_info": "Earthquakes may be a danger in this area"
      }
    };
  
    return resultado
;
  } catch (error) {
    console.error('Erro');
  }
}






// Funções básicas ------------------------------------------------------------
function mean(arr: []) {
  if (arr.length === 0) return 0;

  const sum = arr.reduce((acc, value) => acc + value, 0);
  return sum / arr.length;
}

function sum(arr: []) {
  if (!arr || arr.length === 0) return 0;

  return arr.reduce((acc, value) => acc + value, 0);
}


// Funções pegando informações de outras api's --------------------------------
// Função api UV
async function getUv(args: { [x: string]: any; }, LAT: any, LON: any) { // limite de 50 requisições por dia
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
    throw new Error(`Erro na requisição de UV`);
  }
}

// Função api nasa
async function nasa(data_inicio: string, data_fim: string, lat: number, lon: number, args: string): Promise<{ TMIN: string, TMAX: string, PRECTOT: string, T2M: string }> {
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?start=${data_inicio}&end=${data_fim}&latitude=${lat}&longitude=${lon}&community=sb&parameters=${args}&format=JSON`;
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao obter dados da NASA');
    }
    
    const data = await response.json();

    const TMIN1 = data.properties.parameter.T2M_MIN;
    const TMIN2 = Object.keys(TMIN1).map(key => TMIN1[key]);
    const TMIN = Math.min(...TMIN2);

    const TMAX1 = data.properties.parameter.T2M_MAX;
    const TMAX2 = Object.values(TMAX1).map((value: any) => Number(value));
    const TMAX = Math.max(...TMAX2);

    const PRECTOT1 = data.properties.parameter.PRECTOTCORR;
    const PRECTOT2 = Object.keys(PRECTOT1).map(key => PRECTOT1[key]);
    const PRECTOT = PRECTOT2.reduce((total, value) => total + value, 0);

    const T2M1 = data.properties.parameter.T2M;
    const T2M2 = Object.keys(T2M1).map(key => T2M1[key]);
    const T2M = T2M2.reduce((total, value) => total + value, 0) / T2M2.length;

    return {
      TMIN: TMIN.toFixed(2),
      TMAX: TMAX.toFixed(2),
      PRECTOT: PRECTOT.toFixed(2),
      T2M: T2M.toFixed(2)
    };
  } catch (error) {
    throw new Error(`Erro na requisição da NASA`);
  }
}



// Funções para cálculo do slope
async function getAltitude(url: RequestInfo) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Erro ao obter altitude');
    }
    const data = await response.json();
    return data.results[0].elevation;
  } catch (error) {
    throw new Error(`Erro na requisição de UV`);
  }
}

function slope(altitudes: number[]) {
  const deltaElevation = altitudes[0] - altitudes[1]
  const slope = (deltaElevation/ 111.32) * 100
  return Math.abs(slope)
}

// Função para verificar vulcões próximos
async function obterTitulosEventos(url: RequestInfo) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Erro ao obter dados de vulcoes');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Erro na requisição de vulcoes`);
  }
}

function estaDentroDaDistancia(coord1: [any, any], coord2: [any, any], distanciaMaxKm = 10) {
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

function toRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}
interface RequestParams {
  lat: number;
  lon: number;
  maxradius: number;
  minnbtestimonies: number;
  format: string;
}

async function fetchAndCountEarthquakes(v1: number, v2: number) {
  const baseUrl = 'https://www.seismicportal.eu/testimonies-ws/api/search';
  const params: RequestParams = {
    lat: v1,
    lon: v2,
    maxradius: 1,
    minnbtestimonies: 0,
    format: 'text',
  };

  // Construa a URL com os parâmetros
  const url = new URL(baseUrl);
  Object.keys(params).forEach(key => url.searchParams.append(key, (params as any)[key]));

  try {
    // Faça a solicitação usando fetch
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Erro na solicitação HTTP: ' + response.status);
    }

    // Retorna os dados da resposta
    const data = await response.text();
    const resultados = processarDadosTerremotos(data);
    return resultados;
  } catch (error) {
    console.error(error);
  }

  function processarDadosTerremotos(data: string) {
    const linhas = data.trim().split('\n');
    let df = [];

    for (const linha of linhas) {
      if (!linha.startsWith('#')) {
        const partes = linha.split('|');

        if (partes.length >= 9) {
          const data = partes[1];
          const lat = parseFloat(partes[2]);
          const lon = parseFloat(partes[3]);
          const mag = parseFloat(partes[5]);

          if (!isNaN(lat) && !isNaN(lon) && !isNaN(mag)) {
            const entry = {
              'data': data,
              'lat': lat,
              'lon': lon,
              'mag': mag,
            };
            df.push(entry);
          }
        }
      }
    }
    
    let contagemPorMagnitude = contarTerremotosPorMagnitude(df);
  
    
    const todasSãoZero =
      contagemPorMagnitude.countMagnitude0to4 === 0 &&
      contagemPorMagnitude.countMagnitude4to6 === 0 &&
      contagemPorMagnitude.countMagnitudeAbove6 === 0;

    const dict = {
      "status": !todasSãoZero,
      "Magnitude < 4:": contagemPorMagnitude.countMagnitude0to4,
      "Magnitude 4-6:": contagemPorMagnitude.countMagnitude4to6,
      "Magnitude > 6:": contagemPorMagnitude.countMagnitudeAbove6
    };
    return dict;
  }

  function contarTerremotosPorMagnitude(df: any) {
    let countMagnitude0to4 = 0;
    let countMagnitude4to6 = 0;
    let countMagnitudeAbove6 = 0;

    for (const entry of df) {
      const magnitude = entry.mag;

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
}


// cálculo da FADI ===========================================================================
function getA(temperaturaMedia: number) {
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

function getB(tmax: number, tmin: number) {
  const temperaturaVariacao = Math.abs(tmax - tmin);
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


function getC(precipitacao: number) {
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


function getD(radiacaoUv: number) {
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


function getE(inclinacaoTerreno:number) {
  const inclTerreno = [
    [0, 5, 0.0],
    [5, 10, 0.3],
    [10, 20, 0.6],
    [20, 30, 0.9],
    [30, 45, 1.2],
    [45, 91, 1.5]
  ];

  if (inclinacaoTerreno === null) {
    return 0.6;
  }

  for (const faixa of inclTerreno) {
    if (inclinacaoTerreno >= faixa[0] && inclinacaoTerreno < faixa[1]) {
      return faixa[2];
    }
  }

  return null;
}


function getF(vulcoesAtivos: number) {
  return vulcoesAtivos === 0 ? 0 : vulcoesAtivos > 0 ? 2 : undefined;
}

function getG(terremotosLeves: number) {
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

function getH(terremotosMedio: number) {
  if (terremotosMedio === 0) {
    return 0;
  } else if (terremotosMedio > 0 && terremotosMedio <= 2) {
    return 1;
  } else if (terremotosMedio > 2 && terremotosMedio <= 5) {
    return 2;
  }
}

function getI(terremotosPesados: number) {
  if (terremotosPesados === 0) {
    return 0;
  } else if (terremotosPesados === 1) {
    return 1;
  } else {
    return 2;
  }
}


function FADI_calc(tmed: number, tmax: number, tmin: number, precipitacao: number, radiacaoUv: number, inclinacaoTerreno: number, vulcoesAtivos: number, terremotosLeves: number, terremotosMedio: number, terremotosPesados: number) {
  // Substitua valores nulos ou indefinidos por zero
  tmed = tmed || 0;
  tmax = tmax || 0;
  tmin = tmin || 0;
  precipitacao = precipitacao || 0;
  radiacaoUv = radiacaoUv || 0;
  inclinacaoTerreno = inclinacaoTerreno || 0;
  vulcoesAtivos = vulcoesAtivos || 0;
  terremotosLeves = terremotosLeves || 0;
  terremotosMedio = terremotosMedio || 0;
  terremotosPesados = terremotosPesados || 0;

  const A = getA(tmed);
  const B = getB(tmax, tmin);
  const C = getC(precipitacao);
  const D = getD(radiacaoUv);
  const E = getE(inclinacaoTerreno);
  const F = getF(vulcoesAtivos);
  const G = getG(terremotosLeves);
  const H = getH(terremotosMedio);
  const I = getI(terremotosPesados);

  // Se todos forem válidos, continue com os cálculos
  const index_tempo = (((5 * (A || 0)) + (2 * (B || 0)) + (5 * (C || 0)) + (3 * (D || 0))) / 15);
  const geological_index = (((8 * (F || 0)) + (2 * (G || 0)) + (4 * (H || 0)) + (6 * (I || 0))) / 20);
  const terrain_index = E;

  const result = (index_tempo + geological_index + (terrain_index || 0)).toFixed(3);
  return parseFloat(result);
}
