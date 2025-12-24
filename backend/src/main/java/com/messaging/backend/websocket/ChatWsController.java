package com.messaging.backend.websocket;

import com.messaging.backend.domain.Conversation;
import com.messaging.backend.domain.Message;
import com.messaging.backend.domain.User;
import com.messaging.backend.repository.ConversationRepository;
import com.messaging.backend.repository.MessageRepository;
import com.messaging.backend.repository.UserRepository;
import com.messaging.backend.websocket.dto.ChatMessageRequest;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class ChatWsController {

    private final MessageRepository messages;
    private final ConversationRepository conversations;
    private final UserRepository users;
    private final SimpMessagingTemplate broker;

    public ChatWsController(
            MessageRepository messages,
            ConversationRepository conversations,
            UserRepository users,
            SimpMessagingTemplate broker
    ) {
        this.messages = messages;
        this.conversations = conversations;
        this.users = users;
        this.broker = broker;
    }

    @MessageMapping("/chat.send")
    public void send(ChatMessageRequest req, Principal principal) {
        String username = principal.getName();

        User sender = users.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Conversation conversation = conversations.findById(req.conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        Message saved = messages.save(new Message(req.content, conversation, sender));

        broker.convertAndSend("/topic/conversations/" + req.conversationId, saved);
    }
}