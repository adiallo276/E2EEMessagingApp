package com.messaging.backend.controller;

import com.messaging.backend.domain.Message;
import com.messaging.backend.domain.Conversation;
import com.messaging.backend.domain.User;
import com.messaging.backend.repository.MessageRepository;
import com.messaging.backend.repository.ConversationRepository;
import com.messaging.backend.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/messages")
public class MessageController {

    @Autowired
    private MessageRepository messages;

    @Autowired
    private ConversationRepository conversations;

    @Autowired
    private UserRepository users;

    @PostMapping
    public Message sendMessage(
            @RequestParam Long conversationId,
            @RequestParam String content,
            Principal principal
    ) {
        String username = principal.getName();
        User sender = users.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        Message message = new Message(content, conversation, sender);
        return messages.save(message);
    }

    @GetMapping("/{conversationId}")
    public List<Message> getMessages(@PathVariable Long conversationId) {
        return messages.findByConversationId(conversationId);
    }
}