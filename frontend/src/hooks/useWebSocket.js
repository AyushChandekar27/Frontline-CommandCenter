import { useEffect, useRef, useCallback } from 'react';

const WS_URL = 'http://localhost:8081/ws';

export function useWebSocket(topics, onMessage) {
    const clientRef = useRef(null);
    const reconnectRef = useRef(null);
    const stableMsg = useRef(onMessage);
    stableMsg.current = onMessage;

    const connect = useCallback(() => {
        const loadScript = (src) => new Promise((res, rej) => {
            if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
            const s = document.createElement('script');
            s.src = src; s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });

        Promise.all([
            loadScript('https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js'),
            loadScript('https://cdn.jsdelivr.net/npm/@stomp/stompjs@7/bundles/stomp.umd.min.js'),
        ]).then(() => {
            if (clientRef.current?.active) return;
            const client = new window.StompJs.Client({
                webSocketFactory: () => new window.SockJS(WS_URL),
                reconnectDelay: 5000,
                onConnect: () => {
                    topics.forEach(topic => {
                        client.subscribe(topic, msg => {
                            try { stableMsg.current(topic, JSON.parse(msg.body)); } catch { }
                        });
                    });
                },
            });
            client.activate();
            clientRef.current = client;
        }).catch(() => {
            reconnectRef.current = setTimeout(connect, 6000);
        });
    }, []); // eslint-disable-line

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectRef.current);
            clientRef.current?.deactivate();
            clientRef.current = null;
        };
    }, [connect]);
}
