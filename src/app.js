import http from 'http';
import url from 'url';
import dotenv from 'dotenv';
import TcpClient from './classes/client';
import { makePacket } from './utils/makePacket';

dotenv.config();

const port = process.env.GATE_PORT;

let mapClients = {};
let mapUrls = {};
let mapResponse = {};
let mapRR = {};
let index = 0;

const server = http
  .createServer((req, res) => {
    const method = req.method;
    const uri = url.parse(req.url, true);
    const pathname = uri.pathname;

    if (method === 'POST' || method === 'PUT') {
      let body = '';

      req.on('data', function (data) {
        body += data;
      });
      req.on('end', function () {
        let params;
        if (req.headers['content-type'] === 'application/json') {
          params = JSON.parse(body);
        } else {
          params = new URLSearchParams(body);
        }

        onRequest(res, method, pathname, params);
      });
    } else {
      onRequest(res, method, pathname, uri.query);
    }
  })
  .listen(port, () => {
    console.log(`Example app listening on port ${port}`);

    // Distributor 와 통신 처리
    const packet = makePacket('/distributes', 'POST', 0, {
      port: process.env.GATE_PORT,
      name: 'gate',
      urls: [],
    });

    let isConnectedDistributor = false;

    const clientDistributor = new TcpClient(
      process.env.HOST,
      process.env.DIS_PORT,
      (options) => {
        // 접속 이벤트
        isConnectedDistributor = true;
        clientDistributor.write(packet);
      },
      (options, data) => {
        onDistribute(data);
      }, // 데이터 수신 이벤트
      (options) => {
        isConnectedDistributor = false;
      }, // 접속 종료 이벤트
      (options) => {
        isConnectedDistributor = false;
      }, // 에러 이벤트
    );

    // 주기적인 Distributor 접속 상태 확인
    setInterval(() => {
      if (isConnectedDistributor !== true) {
        clientDistributor.connect();
      }
    }, 3000);
  });

// API 호출 처리
export function onRequest(res, method, pathname, params) {
  const key = method + pathname;
  const client = mapUrls[key];
  if (client == null) {
    res.writeHead(404);
    res.end();
  } else {
    const packet = makePacket(pathname, method, index, params);

    mapResponse[`key_${index}`] = res;
    index++;
    if (mapRR[key] == null) {
      mapRR[key] = 0;
    }

    mapRR[key]++;
    client[mapRR[key] % client.length].write(packet);
  }
}

export function onDistribute(data) {
  for (let n in data.params) {
    const node = data.params[n];
    const key = node.host + ':' + node.port;

    if (mapClients[key] == null && node.name !== 'gate') {
      const client = new TcpClient(
        node.host,
        node.port,
        onCreateClient,
        onReadClient,
        onEndClient,
        onErrorClient,
      );

      mapClients[key] = {
        client: client,
        info: node,
      };

      for (let m in node.urls) {
        const key = node.urls[m];
        if (mapUrls[key] == null) {
          mapUrls[key] = [];
        }
        mapUrls[key].push(client);
      }
      client.connect();
    }
  }
}

// 마이크로서비스 접속 이벤트 처리
function onCreateClient(options) {
  console.log('onCreateClient');
}

// 마이크로서비스 응답 처리
function onReadClient(options, packet) {
  console.log('onReadClient', packet);

  mapResponse[`key_${packet.key}`].writeHead(200, { 'Content-Type': 'application/json' });
  mapResponse[`key_${packet.key}`].end(JSON.stringify(packet));
  delete mapResponse[`key_${packet.key}`]; // http 응답 객체 삭제
}

// 마이크로서비스 접속 종료 처리
function onEndClient(options) {
  const key = options.host + ':' + options.port;
  console.log('onEndClient', mapClients[key]);

  for (let n in mapClients[key].info.urls) {
    const node = mapClients[key].info.urls[n];
    delete mapUrls[node];
  }
  delete mapClients[key];
}

// 마이크로서비스 접속 에러 처리
function onErrorClient(options) {
  console.log('onErrorClient');
}
