
const LAT = 12.3456;  // Substitua com a latitude desejada
const LON = 78.9101;  // Substitua com a longitude desejada
const dataAtual = "20231005";
const dataPassada = "20230905";

async function run() {
  try {
    const args_uv = {
      'Content-Type': 'application/json',
      'x-access-token': 'key'
    };

    const args_nasa = "PRECTOT,T2M,T2M_MAX,T2M_MIN,RH2M,ALLSKY_SFC_UVA";
    const uvData = await getUv(args_uv, LAT, LON);
    const nasaData = await nasa(dataPassada, dataAtual, LAT, LON, args_nasa);
    console.log(uvData,nasaData);
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

async function getUv(args, LAT, LON) {
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
    return data;
  } catch (error) {
    throw new Error(`Erro na requisição de UV: ${error.message}`);
  }
}

async function nasa(data_inicio, data_fim, lat, lon, args) {
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
    return data;
  } catch (error) {
    throw new Error(`Erro na requisição da NASA: ${error.message}`);
  }
}


run(); // Chama a função para executar o código assíncrono
