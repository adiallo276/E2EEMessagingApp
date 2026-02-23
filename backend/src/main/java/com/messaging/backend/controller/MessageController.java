package com.messaging.backend.controller;

import com.messaging.backend.domain.Message;
import com.messaging.backend.repository.MessageRepository;
import com.messaging.backend.websocket.dto.MessageDto;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/messages")
public class MessageController {

    private final MessageRepository messages;

    public MessageController(MessageRepository messages) {
        this.messages = messages;
    }

    @GetMapping("/{conversationId}")
    public List<MessageDto> byConversation(@PathVariable Long conversationId, Principal principal) {
        return messages.findByConversationId(conversationId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @GetMapping("/{conversationId}/last")
    public org.springframework.http.ResponseEntity<MessageDto> lastMessage(@PathVariable Long conversationId, Principal principal) {
        List<Message> msgs = messages.findByConversationId(conversationId);
        if (msgs.isEmpty()) {
            return org.springframework.http.ResponseEntity.noContent().build();
        }
        // Get the last message (most recent)
        Message last = msgs.get(msgs.size() - 1);
        return org.springframework.http.ResponseEntity.ok(toDto(last));
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