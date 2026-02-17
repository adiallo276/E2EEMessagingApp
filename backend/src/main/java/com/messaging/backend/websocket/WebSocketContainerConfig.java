package com.messaging.backend.websocket;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
public class WebSocketContainerConfig {

    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        // Set max text message buffer size to 10MB
        container.setMaxTextMessageBufferSize(10 * 1024 * 1024);
        // Set max binary message buffer size to 10MB  
        container.setMaxBinaryMessageBufferSize(10 * 1024 * 1024);
        // Set max session idle timeout to 60 seconds
        container.setMaxSessionIdleTimeout(60000L);
        return container;
    }
}
