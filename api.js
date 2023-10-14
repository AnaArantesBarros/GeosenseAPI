
const LAT = 12.3456;  // Substitua com a latitude desejada
const LON = 78.9101;  // Substitua com a longitude desejada

async function run() {
  try {
    const args = {
      'Content-Type': 'application/json',
      'x-access-token': 'openuv-11ntv7rlnfbhz2x-io'
    };

    const uvData = await getUv(args, LAT, LON);
    console.log(uvData);
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

async function getUv(args, LAT, LON) {
  const url = `https://api.openuv.io/api/v1/uv?lat=${LAT}&lng=${LON}`;
  try {
    const response = await fetch(url, { headers: args });
    if (!response.ok) {
      throw new Error('Erro ao obter dados de UV');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Erro na requisição de UV: ${error.message}`);
  }
}

run(); // Chama a função para executar o código assíncrono
