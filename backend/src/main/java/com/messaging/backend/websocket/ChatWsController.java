package com.messaging.backend.websocket;

import com.messaging.backend.domain.*;
import com.messaging.backend.repository.ConversationRepository;
import com.messaging.backend.repository.MessageRepository;
import com.messaging.backend.repository.UserRepository;
import com.messaging.backend.websocket.dto.ChatMessageRequest;
import com.messaging.backend.websocket.dto.DeleteMessageRequest;
import com.messaging.backend.websocket.dto.EditMessageRequest;
import com.messaging.backend.websocket.dto.MessageDto;
import com.messaging.backend.websocket.dto.TypingEvent;
import com.messaging.backend.websocket.dto.ReadReceipt;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;

@Controller
public class ChatWsController {

    private static final Logger log = LoggerFactory.getLogger(ChatWsController.class);

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
        log.info("[ChatWs] Received message for conversation {}, content length: {}", 
                 req.conversationId, req.content != null ? req.content.length() : 0);
        
        if (principal == null) {
            log.error("[ChatWs] Unauthenticated STOMP session");
            throw new RuntimeException("Unauthenticated STOMP session");
        }

        String username = principal.getName();
        log.info("[ChatWs] Sender: {}", username);

        User sender = users.findByUsername(username)
                .orElseThrow(() -> {
                    log.error("[ChatWs] User not found: {}", username);
                    return new RuntimeException("User not found");
                });

        Conversation conversation = conversations.findById(req.conversationId)
                .orElseThrow(() -> {
                    log.error("[ChatWs] Conversation not found: {}", req.conversationId);
                    return new RuntimeException("Conversation not found");
                });

        if (!conversation.hasParticipant(username)) {
            log.error("[ChatWs] User {} is not a participant of conversation {}", username, req.conversationId);
            throw new RuntimeException("Forbidden");
        }

        Message saved;
        if (req.e2ee) {
            if (conversation.getE2eeState() != E2eeState.ON) {
                log.error("[ChatWs] E2EE not enabled for conversation {}", req.conversationId);
                throw new RuntimeException("E2EE not enabled");
            }
            saved = messages.save(new Message(conversation, sender, req.ivB64, req.ciphertextB64));
        } else {
            saved = messages.save(new Message(conversation, sender, req.content));
        }
        
        log.info("[ChatWs] Message saved with id {}, broadcasting to /topic/conversations/{}", 
                 saved.getId(), req.conversationId);

        broker.convertAndSend("/topic/conversations/" + req.conversationId, toDto(saved));
        log.info("[ChatWs] Message broadcast complete");
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
        d.edited = m.isEdited();
        d.editedAt = m.getEditedAt();
        d.deleted = m.isDeleted();
        return d;
    }

    @MessageMapping("/chat.edit")
    public void editMessage(EditMessageRequest req, Principal principal) {
        if (principal == null) {
            throw new RuntimeException("Unauthenticated STOMP session");
        }

        String username = principal.getName();

        Message message = messages.findById(req.messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        if (!message.getSender().getUsername().equals(username)) {
            throw new RuntimeException("Cannot edit another user's message");
        }

        if (!message.getConversation().getId().equals(req.conversationId)) {
            throw new RuntimeException("Message does not belong to this conversation");
        }

        message.setContent(req.content);
        message.setEdited(true);
        message.setEditedAt(Instant.now());
        messages.save(message);

        broker.convertAndSend("/topic/conversations/" + req.conversationId, toDto(message));
    }

    @MessageMapping("/chat.delete")
    public void deleteMessage(DeleteMessageRequest req, Principal principal) {
        if (principal == null) {
            throw new RuntimeException("Unauthenticated STOMP session");
        }

        String username = principal.getName();

        Message message = messages.findById(req.messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        if (!message.getSender().getUsername().equals(username)) {
            throw new RuntimeException("Cannot delete another user's message");
        }

        if (!message.getConversation().getId().equals(req.conversationId)) {
            throw new RuntimeException("Message does not belong to this conversation");
        }

        message.setDeleted(true);
        message.setContent(null);
        message.setIvB64(null);
        message.setCiphertextB64(null);
        messages.save(message);

        broker.convertAndSend("/topic/conversations/" + req.conversationId, toDto(message));
    }

    @MessageMapping("/chat.typing")
    public void typing(TypingEvent event, Principal principal) {
        if (principal == null) {
            throw new RuntimeException("Unauthenticated STOMP session");
        }

        String username = principal.getName();
        
        Conversation conversation = conversations.findById(event.conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        if (!conversation.hasParticipant(username)) {
            throw new RuntimeException("Forbidden");
        }

        // Broadcast typing event to conversation
        event.username = username;
        broker.convertAndSend("/topic/conversations/" + event.conversationId + "/typing", event);
    }

    @MessageMapping("/chat.read")
    public void markRead(ReadReceipt receipt, Principal principal) {
        if (principal == null) {
            throw new RuntimeException("Unauthenticated STOMP session");
        }

        String username = principal.getName();
        
        Conversation conversation = conversations.findById(receipt.conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        if (!conversation.hasParticipant(username)) {
            throw new RuntimeException("Forbidden");
        }

        // Broadcast read receipt to conversation
        receipt.username = username;
        receipt.readAt = Instant.now();
        broker.convertAndSend("/topic/conversations/" + receipt.conversationId + "/read", receipt);
    }
}