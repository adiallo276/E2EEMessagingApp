package com.messaging.backend.websocket;

import com.messaging.backend.domain.*;
import com.messaging.backend.repository.ConversationRepository;
import com.messaging.backend.repository.MessageRepository;
import com.messaging.backend.repository.UserRepository;
import com.messaging.backend.websocket.dto.ChatMessageRequest;
import com.messaging.backend.websocket.dto.MessageDto;
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
        if (principal == null) throw new RuntimeException("Unauthenticated STOMP session");

        String username = principal.getName();

        User sender = users.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Conversation conversation = conversations.findById(req.conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        if (!conversation.hasParticipant(username)) throw new RuntimeException("Forbidden");

        Message saved;
        if (req.e2ee) {
            if (conversation.getE2eeState() != E2eeState.ON) throw new RuntimeException("E2EE not enabled");
            saved = messages.save(new Message(conversation, sender, req.ivB64, req.ciphertextB64));
        } else {
            saved = messages.save(new Message(conversation, sender, req.content));
        }

        broker.convertAndSend("/topic/conversations/" + req.conversationId, toDto(saved));
    }

    private MessageDto toDto(Message m) {
        MessageDto d = new MessageDto();
        d.id = m.getId();
        d.conversationId = m.getConversation().getId();
        d.senderUsername = m.getSender().getUsername();
        d.content = m.getContent();
        d.e2ee = m.isE2ee();
        d.ivB64 = m.getIvB64();
        d.ciphertextB64 = m.getCiphertextB64();
        d.timestamp = m.getTimestamp();
        return d;
    }
}