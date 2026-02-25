package com.messaging.backend.controller;

import com.messaging.backend.domain.Conversation;
import com.messaging.backend.domain.User;
import com.messaging.backend.repository.ConversationRepository;
import com.messaging.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/conversations")
public class ConversationController {

    @Autowired
    private ConversationRepository conversations;

    @Autowired
    private UserRepository users;

    @PostMapping
    public Conversation createConversation(@RequestParam String user2, Principal principal) {
        String username1 = principal.getName();
        
        User user1 = users.findByUsername(username1)
                .orElseThrow(() -> new RuntimeException("User not found"));

        User user2Obj = users.findByUsername(user2)
                .orElseThrow(() -> new RuntimeException("Other user not found"));

        Conversation conversation = new Conversation(user1, user2Obj);
        return conversations.save(conversation);
    }

    @GetMapping("/me")
    public List<Conversation> myConversations(Principal principal) {
        String username = principal.getName();
        User currentUser = users.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return conversations.findAll().stream()
                .filter(c -> c.getUser1().getId().equals(currentUser.getId())
                        || c.getUser2().getId().equals(currentUser.getId()))
                .toList();
    }

    @GetMapping("/{id}")
    public Conversation getConversation(@PathVariable Long id) {
        return conversations.findById(id)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));
    }
}