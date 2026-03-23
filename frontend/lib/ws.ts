import { Client } from "@stomp/stompjs";

export function connectWs(onConnect: (client: Client) => void) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No token");

  const client = new Client({
    brokerURL: `ws://localhost:8080/ws?token=${encodeURIComponent(token)}`,
    reconnectDelay: 2000,
  });

  client.onConnect = () => onConnect(client);
  client.activate();

  return client;
}