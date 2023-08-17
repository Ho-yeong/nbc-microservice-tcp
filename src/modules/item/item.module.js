import TcpServer from '../../classes/server';
import dotenv from 'dotenv';
import onRequest from './item.service';

dotenv.config();

class ItemModule extends TcpServer {
  constructor() {
    // 부모 클래스 생성자 호출
    super('items', process.env.ITEM_PORT ? Number(process.env.ITEM_PORT) : 9010, ['GET/items']);

    this.connectToDistributor(process.env.HOST, process.env.DIS_PORT, (data) => {
      // Distributor 접속
      console.log('Distributor Notification', data);
    });
  }

  // 클라이언트 요청에 따른 비즈니스 로직 호출
  onRead(socket, data) {
    console.log('onRead', socket.remoteAddress, socket.remotePort, data);
    onRequest(socket, data.method, data.uri, data.params, data.key, (s, packet) => {
      console.log(packet);
      socket.write(JSON.stringify(packet) + '¶');
    });
  }
}

new ItemModule(); // 인스턴스 생성
