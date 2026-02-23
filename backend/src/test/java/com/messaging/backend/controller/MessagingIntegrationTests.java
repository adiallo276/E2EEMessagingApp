package com.messaging.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.messaging.backend.domain.Conversation;
import com.messaging.backend.domain.Message;
import com.messaging.backend.domain.User;
import com.messaging.backend.repository.ConversationRepository;
import com.messaging.backend.repository.MessageRepository;
import com.messaging.backend.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Comprehensive integration tests for the messaging application.
 * Tests authentication, conversations, messages, and API endpoints.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MessagingIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private MessageRepository messageRepository;

    private static String testUser1Token;
    private static String testUser2Token;
    private static Long testConversationId;

    // ==================== AUTHENTICATION TESTS ====================

    @Test
    @Order(1)
    @DisplayName("Should register a new user successfully")
    void testUserRegistration() throws Exception {
        // Clean up existing test users
        userRepository.findByUsername("testuser1").ifPresent(userRepository::delete);
        userRepository.findByUsername("testuser2").ifPresent(userRepository::delete);

        // Register first test user
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"testuser1\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User registered successfully"));

        // Register second test user
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"testuser2\",\"password\":\"password456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User registered successfully"));

        // Verify users exist in database
        assertTrue(userRepository.findByUsername("testuser1").isPresent());
        assertTrue(userRepository.findByUsername("testuser2").isPresent());
    }

    @Test
    @Order(2)
    @DisplayName("Should reject duplicate username registration")
    void testDuplicateRegistration() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"testuser1\",\"password\":\"newpassword\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @Order(3)
    @DisplayName("Should login successfully and return JWT token")
    void testUserLogin() throws Exception {
        // Login as testuser1
        MvcResult result1 = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"testuser1\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.username").value("testuser1"))
                .andReturn();

        String response1 = result1.getResponse().getContentAsString();
        testUser1Token = objectMapper.readTree(response1).get("token").asText();
        assertNotNull(testUser1Token);

        // Login as testuser2
        MvcResult result2 = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"testuser2\",\"password\":\"password456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andReturn();

        String response2 = result2.getResponse().getContentAsString();
        testUser2Token = objectMapper.readTree(response2).get("token").asText();
        assertNotNull(testUser2Token);
    }

    @Test
    @Order(4)
    @DisplayName("Should reject invalid credentials")
    void testInvalidLogin() throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"testuser1\",\"password\":\"wrongpassword\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(5)
    @DisplayName("Should reject requests without authentication")
    void testUnauthenticatedAccess() throws Exception {
        mockMvc.perform(get("/conversations/me"))
                .andExpect(status().isUnauthorized());
    }

    // ==================== CONVERSATION TESTS ====================

    @Test
    @Order(10)
    @DisplayName("Should create a new conversation")
    void testCreateConversation() throws Exception {
        MvcResult result = mockMvc.perform(post("/conversations")
                        .header("Authorization", "Bearer " + testUser1Token)
                        .param("user2", "testuser2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists())
                .andReturn();

        String response = result.getResponse().getContentAsString();
        testConversationId = objectMapper.readTree(response).get("id").asLong();
        assertNotNull(testConversationId);
    }

    @Test
    @Order(11)
    @DisplayName("Should get user's conversations")
    void testGetConversations() throws Exception {
        mockMvc.perform(get("/conversations/me")
                        .header("Authorization", "Bearer " + testUser1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));

        // testuser2 should also see the conversation
        mockMvc.perform(get("/conversations/me")
                        .header("Authorization", "Bearer " + testUser2Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    // ==================== MESSAGE TESTS ====================

    @Test
    @Order(20)
    @DisplayName("Should get messages for a conversation")
    void testGetMessages() throws Exception {
        mockMvc.perform(get("/messages/" + testConversationId)
                        .header("Authorization", "Bearer " + testUser1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @Order(21)
    @DisplayName("Should create and retrieve messages")
    void testMessageRetrieval() throws Exception {
        // Get conversation and user
        Conversation conv = conversationRepository.findById(testConversationId).orElseThrow();
        User sender = userRepository.findByUsername("testuser1").orElseThrow();
        
        // Create a message using constructor
        Message msg = new Message(conv, sender, "Hello, this is a test message!");
        messageRepository.save(msg);

        // Retrieve messages
        mockMvc.perform(get("/messages/" + testConversationId)
                        .header("Authorization", "Bearer " + testUser1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @Order(22)
    @DisplayName("Should get last message")
    void testGetLastMessage() throws Exception {
        mockMvc.perform(get("/messages/" + testConversationId + "/last")
                        .header("Authorization", "Bearer " + testUser1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").exists());
    }

    // ==================== E2EE MESSAGE FORMAT TESTS ====================

    @Test
    @Order(30)
    @DisplayName("Should handle E2EE HELLO message format")
    void testE2eeHelloMessage() throws Exception {
        String helloContent = "{\"type\":\"E2EE_HELLO\",\"v\":1,\"alg\":\"kyber\",\"pk\":{}}";
        
        Conversation conv = conversationRepository.findById(testConversationId).orElseThrow();
        User sender = userRepository.findByUsername("testuser1").orElseThrow();
        
        Message msg = new Message(conv, sender, helloContent);
        messageRepository.save(msg);

        mockMvc.perform(get("/messages/" + testConversationId + "/last")
                        .header("Authorization", "Bearer " + testUser1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value(containsString("E2EE_HELLO")));
    }

    @Test
    @Order(31)
    @DisplayName("Should handle E2EE encrypted message format")
    void testE2eeEncryptedMessage() throws Exception {
        String encryptedContent = "{\"type\":\"E2EE_MSG\",\"v\":1,\"ivB64\":\"randomiv\",\"ciphertextB64\":\"encrypteddata\"}";
        
        Conversation conv = conversationRepository.findById(testConversationId).orElseThrow();
        User sender = userRepository.findByUsername("testuser1").orElseThrow();
        
        Message msg = new Message(conv, sender, encryptedContent);
        messageRepository.save(msg);

        mockMvc.perform(get("/messages/" + testConversationId + "/last")
                        .header("Authorization", "Bearer " + testUser1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value(containsString("E2EE_MSG")));
    }

    // ==================== IMAGE MESSAGE TESTS ====================

    @Test
    @Order(40)
    @DisplayName("Should handle image message format")
    void testImageMessage() throws Exception {
        String imageContent = "IMG:image/png:iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        
        Conversation conv = conversationRepository.findById(testConversationId).orElseThrow();
        User sender = userRepository.findByUsername("testuser1").orElseThrow();
        
        Message msg = new Message(conv, sender, imageContent);
        messageRepository.save(msg);

        mockMvc.perform(get("/messages/" + testConversationId + "/last")
                        .header("Authorization", "Bearer " + testUser1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value(startsWith("IMG:")));
    }

    // ==================== JWT TOKEN TESTS ====================

    @Test
    @Order(50)
    @DisplayName("Should reject invalid tokens")
    void testInvalidToken() throws Exception {
        mockMvc.perform(get("/conversations/me")
                        .header("Authorization", "Bearer invalid.token.here"))
                .andExpect(status().isUnauthorized());
    }
}
