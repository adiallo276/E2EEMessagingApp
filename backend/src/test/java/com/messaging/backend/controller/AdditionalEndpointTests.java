package com.messaging.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.messaging.backend.domain.Conversation;
import com.messaging.backend.domain.Message;
import com.messaging.backend.domain.User;
import com.messaging.backend.repository.ConversationRepository;
import com.messaging.backend.repository.MessageRepository;
import com.messaging.backend.repository.UserRepository;
import com.messaging.backend.security.jwt.JwtUtil;
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
 * Additional integration tests covering MeController, conversation edge cases,
 * JWT security, message ordering, and authorization checks.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AdditionalEndpointTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private ConversationRepository conversationRepository;
    @Autowired private MessageRepository messageRepository;
    @Autowired private JwtUtil jwtUtil;

    private static String user1Token;
    private static String user2Token;
    private static String user3Token;
    private static Long conv12Id;
    private static Long conv13Id;

    // ==================== SETUP ====================

    @Test
    @Order(1)
    @DisplayName("Setup: Create test users")
    void setupUsers() throws Exception {
        // Clean up existing test users
        userRepository.findByUsername("extra_user1").ifPresent(userRepository::delete);
        userRepository.findByUsername("extra_user2").ifPresent(userRepository::delete);
        userRepository.findByUsername("extra_user3").ifPresent(userRepository::delete);

        // Register three users
        for (String[] u : new String[][]{
                {"extra_user1", "pass1"},
                {"extra_user2", "pass2"},
                {"extra_user3", "pass3"}
        }) {
            mockMvc.perform(post("/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"" + u[0] + "\",\"password\":\"" + u[1] + "\"}"))
                    .andExpect(status().isOk());
        }

        // Login all three - login returns raw JWT string
        user1Token = loginAndGetToken("extra_user1", "pass1");
        user2Token = loginAndGetToken("extra_user2", "pass2");
        user3Token = loginAndGetToken("extra_user3", "pass3");

        assertNotNull(user1Token);
        assertNotNull(user2Token);
        assertNotNull(user3Token);
    }

    private String loginAndGetToken(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        // Login returns raw JWT token string (may be wrapped in JSON quotes)
        return result.getResponse().getContentAsString().replaceAll("^\"|\"$", "");
    }

    // ==================== ME CONTROLLER TESTS ====================

    @Test
    @Order(10)
    @DisplayName("GET /me should return authenticated username")
    void testMeEndpoint() throws Exception {
        mockMvc.perform(get("/me")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("extra_user1")));
    }

    @Test
    @Order(11)
    @DisplayName("GET /me should return different usernames for different tokens")
    void testMeEndpointDifferentUsers() throws Exception {
        mockMvc.perform(get("/me")
                        .header("Authorization", "Bearer " + user2Token))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("extra_user2")));

        mockMvc.perform(get("/me")
                        .header("Authorization", "Bearer " + user3Token))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("extra_user3")));
    }

    @Test
    @Order(12)
    @DisplayName("GET /me should reject unauthenticated request")
    void testMeUnauthenticated() throws Exception {
        mockMvc.perform(get("/me"))
                .andExpect(status().isUnauthorized());
    }

    // ==================== CONVERSATION EDGE CASES ====================

    @Test
    @Order(20)
    @DisplayName("Should create multiple conversations between different user pairs")
    void testMultipleConversations() throws Exception {
        // user1 <-> user2
        MvcResult r1 = mockMvc.perform(post("/conversations")
                        .header("Authorization", "Bearer " + user1Token)
                        .param("user2", "extra_user2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists())
                .andReturn();
        conv12Id = objectMapper.readTree(r1.getResponse().getContentAsString()).get("id").asLong();

        // user1 <-> user3
        MvcResult r2 = mockMvc.perform(post("/conversations")
                        .header("Authorization", "Bearer " + user1Token)
                        .param("user2", "extra_user3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists())
                .andReturn();
        conv13Id = objectMapper.readTree(r2.getResponse().getContentAsString()).get("id").asLong();

        // IDs should be different
        assertNotEquals(conv12Id, conv13Id);
    }

    @Test
    @Order(21)
    @DisplayName("User should see all their conversations")
    void testUserSeesAllConversations() throws Exception {
        mockMvc.perform(get("/conversations/me")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(2))));
    }

    @Test
    @Order(22)
    @DisplayName("User3 should only see conversations they're part of")
    void testUserSeesOnlyOwnConversations() throws Exception {
        MvcResult result = mockMvc.perform(get("/conversations/me")
                        .header("Authorization", "Bearer " + user3Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andReturn();

        String json = result.getResponse().getContentAsString();
        var conversations = objectMapper.readTree(json);
        // user3 should only see conversations they participate in
        for (var conv : conversations) {
            String u1 = conv.get("user1").get("username").asText();
            String u2 = conv.get("user2").get("username").asText();
            assertTrue(u1.equals("extra_user3") || u2.equals("extra_user3"),
                    "User3 should only see their own conversations");
        }
    }

    @Test
    @Order(23)
    @DisplayName("Should get specific conversation by ID")
    void testGetConversationById() throws Exception {
        mockMvc.perform(get("/conversations/" + conv12Id)
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(conv12Id));
    }

    // ==================== MESSAGE TESTS ====================

    @Test
    @Order(30)
    @DisplayName("Should handle multiple messages in a conversation")
    void testMultipleMessages() throws Exception {
        Conversation conv = conversationRepository.findById(conv12Id).orElseThrow();
        User sender = userRepository.findByUsername("extra_user1").orElseThrow();

        for (int i = 0; i < 5; i++) {
            messageRepository.save(new Message(conv, sender, "Message #" + i));
        }

        mockMvc.perform(get("/messages/" + conv12Id)
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(5))));
    }

    @Test
    @Order(31)
    @DisplayName("Last message should be the most recent one")
    void testLastMessageIsNewest() throws Exception {
        Conversation conv = conversationRepository.findById(conv12Id).orElseThrow();
        User sender = userRepository.findByUsername("extra_user1").orElseThrow();

        messageRepository.save(new Message(conv, sender, "This is the latest message"));

        mockMvc.perform(get("/messages/" + conv12Id + "/last")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("This is the latest message"));
    }

    @Test
    @Order(32)
    @DisplayName("Messages in one conversation should not appear in another")
    void testMessageIsolation() throws Exception {
        Conversation conv13 = conversationRepository.findById(conv13Id).orElseThrow();
        User sender = userRepository.findByUsername("extra_user1").orElseThrow();

        messageRepository.save(new Message(conv13, sender, "Only in conv13"));

        // conv12 should not contain conv13's messages
        MvcResult result = mockMvc.perform(get("/messages/" + conv12Id)
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andReturn();

        String json = result.getResponse().getContentAsString();
        assertFalse(json.contains("Only in conv13"));
    }

    @Test
    @Order(33)
    @DisplayName("Should handle E2EE message storage")
    void testE2eeMessageStorage() throws Exception {
        Conversation conv = conversationRepository.findById(conv12Id).orElseThrow();
        User sender = userRepository.findByUsername("extra_user1").orElseThrow();

        Message e2eeMsg = new Message(conv, sender, "randomIvBase64", "encryptedCiphertextBase64");
        messageRepository.save(e2eeMsg);

        mockMvc.perform(get("/messages/" + conv12Id + "/last")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.e2ee").value(true))
                .andExpect(jsonPath("$.ivB64").value("randomIvBase64"))
                .andExpect(jsonPath("$.ciphertextB64").value("encryptedCiphertextBase64"));
    }

    // ==================== JWT SECURITY TESTS ====================

    @Test
    @Order(40)
    @DisplayName("Should reject malformed token")
    void testMalformedToken() throws Exception {
        mockMvc.perform(get("/conversations/me")
                        .header("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.malformed.signature"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(41)
    @DisplayName("Should reject empty Authorization header")
    void testEmptyAuthHeader() throws Exception {
        mockMvc.perform(get("/conversations/me")
                        .header("Authorization", ""))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(42)
    @DisplayName("Should reject Bearer without token")
    void testBearerWithoutToken() throws Exception {
        mockMvc.perform(get("/conversations/me")
                        .header("Authorization", "Bearer "))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(43)
    @DisplayName("Should reject non-Bearer auth scheme")
    void testNonBearerAuth() throws Exception {
        mockMvc.perform(get("/conversations/me")
                        .header("Authorization", "Basic dXNlcjpwYXNz"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(44)
    @DisplayName("JwtUtil should generate valid token and extract username")
    void testJwtUtilDirectly() {
        String token = jwtUtil.generateToken("directTestUser");
        assertNotNull(token);
        assertTrue(token.length() > 20);

        String extracted = jwtUtil.extractUsername(token);
        assertEquals("directTestUser", extracted);
    }

    @Test
    @Order(45)
    @DisplayName("JwtUtil should reject random string as token")
    void testJwtUtilRejectsGarbage() {
        assertThrows(Exception.class, () -> jwtUtil.extractUsername("not.a.valid.jwt"));
    }

    // ==================== AUTH EDGE CASES ====================

    @Test
    @Order(50)
    @DisplayName("Login response should be a valid JWT token string")
    void testLoginResponseFormat() throws Exception {
        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"extra_user1\",\"password\":\"pass1\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String token = result.getResponse().getContentAsString().replaceAll("^\"|\"$", "");
        // Token should be a valid JWT (3 dot-separated parts)
        assertTrue(token.contains("."), "Response should be a JWT token");
        String[] parts = token.split("\\.");
        assertTrue(parts.length >= 2, "JWT should have at least 2 parts");
    }

    @Test
    @Order(51)
    @DisplayName("Should reject login with non-existent user")
    void testLoginNonExistentUser() {
        // AuthController throws RuntimeException for non-existent user, which propagates through MockMvc
        assertThrows(Exception.class, () ->
            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"non_existent_user\",\"password\":\"password\"}"))
        );
    }

    @Test
    @Order(52)
    @DisplayName("Duplicate registration should fail")
    void testDuplicateRegistration() {
        // DB constraint violation propagates as an exception through MockMvc
        assertThrows(Exception.class, () ->
            mockMvc.perform(post("/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"extra_user1\",\"password\":\"different_pass\"}"))
        );
    }

    @Test
    @Order(53)
    @DisplayName("Should reject login with wrong password")
    void testLoginWrongPassword() {
        // AuthController throws RuntimeException for wrong password, which propagates through MockMvc
        assertThrows(Exception.class, () ->
            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"extra_user1\",\"password\":\"wrong_password\"}"))
        );
    }

    // ==================== CONVERSATION DOMAIN TESTS ====================

    @Test
    @Order(60)
    @DisplayName("Conversation should track correct participants")
    void testConversationParticipants() throws Exception {
        Conversation conv = conversationRepository.findById(conv12Id).orElseThrow();
        assertTrue(conv.hasParticipant("extra_user1"));
        assertTrue(conv.hasParticipant("extra_user2"));
        assertFalse(conv.hasParticipant("extra_user3"));
    }

    @Test
    @Order(61)
    @DisplayName("Conversation otherParticipant should return the other user")
    void testConversationOtherParticipant() throws Exception {
        Conversation conv = conversationRepository.findById(conv12Id).orElseThrow();
        assertEquals("extra_user2", conv.otherParticipant("extra_user1"));
        assertEquals("extra_user1", conv.otherParticipant("extra_user2"));
    }

    @Test
    @Order(62)
    @DisplayName("New conversation should have E2EE state OFF")
    void testNewConversationE2eeState() throws Exception {
        Conversation conv = conversationRepository.findById(conv12Id).orElseThrow();
        assertEquals(com.messaging.backend.domain.E2eeState.OFF, conv.getE2eeState());
    }

    // ==================== MESSAGE DOMAIN TESTS ====================

    @Test
    @Order(70)
    @DisplayName("Plaintext message should have e2ee=false and null IV/ciphertext")
    void testPlaintextMessageDomain() {
        Conversation conv = conversationRepository.findById(conv12Id).orElseThrow();
        User sender = userRepository.findByUsername("extra_user1").orElseThrow();

        Message msg = new Message(conv, sender, "Plain text message");
        Message saved = messageRepository.save(msg);

        assertFalse(saved.isE2ee());
        assertEquals("Plain text message", saved.getContent());
        assertNull(saved.getIvB64());
        assertNull(saved.getCiphertextB64());
        assertNotNull(saved.getTimestamp());
    }

    @Test
    @Order(71)
    @DisplayName("E2EE message should have e2ee=true and populated IV/ciphertext")
    void testE2eeMessageDomain() {
        Conversation conv = conversationRepository.findById(conv12Id).orElseThrow();
        User sender = userRepository.findByUsername("extra_user1").orElseThrow();

        Message msg = new Message(conv, sender, "ivBase64Data", "ciphertextBase64Data");
        Message saved = messageRepository.save(msg);

        assertTrue(saved.isE2ee());
        assertEquals("ivBase64Data", saved.getIvB64());
        assertEquals("ciphertextBase64Data", saved.getCiphertextB64());
        assertNull(saved.getContent());
        assertNotNull(saved.getTimestamp());
    }
}
