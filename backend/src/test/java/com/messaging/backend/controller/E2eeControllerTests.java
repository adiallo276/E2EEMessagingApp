package com.messaging.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.messaging.backend.domain.Conversation;
import com.messaging.backend.domain.User;
import com.messaging.backend.repository.ConversationRepository;
import com.messaging.backend.repository.ConversationE2eeKeyRepository;
import com.messaging.backend.repository.ConversationKemEnvelopeRepository;
import com.messaging.backend.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for the E2EE controller endpoints.
 * Tests public key publishing, retrieval, KEM envelope sending, and pending envelope retrieval.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class E2eeControllerTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private ConversationRepository conversationRepository;
    @Autowired private ConversationE2eeKeyRepository e2eeKeyRepository;
    @Autowired private ConversationKemEnvelopeRepository kemEnvelopeRepository;
    @Autowired private BCryptPasswordEncoder passwordEncoder;

    private static String aliceToken;
    private static String bobToken;
    private static Long conversationId;

    @Test
    @Order(1)
    @DisplayName("Setup: Create users and conversation for E2EE tests")
    void setupUsersAndConversation() throws Exception {
        // Clean up
        kemEnvelopeRepository.deleteAll();
        e2eeKeyRepository.deleteAll();
        userRepository.findByUsername("e2ee_alice").ifPresent(userRepository::delete);
        userRepository.findByUsername("e2ee_bob").ifPresent(userRepository::delete);

        // Register users
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"e2ee_alice\",\"password\":\"password123\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"e2ee_bob\",\"password\":\"password456\"}"))
                .andExpect(status().isOk());

        // Login - returns raw JWT token string
        MvcResult r1 = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"e2ee_alice\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        aliceToken = r1.getResponse().getContentAsString().replaceAll("^\"|\"$", "");

        MvcResult r2 = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"e2ee_bob\",\"password\":\"password456\"}"))
                .andExpect(status().isOk())
                .andReturn();
        bobToken = r2.getResponse().getContentAsString().replaceAll("^\"|\"$", "");

        // Create conversation
        MvcResult convResult = mockMvc.perform(post("/conversations")
                        .header("Authorization", "Bearer " + aliceToken)
                        .param("user2", "e2ee_bob"))
                .andExpect(status().isOk())
                .andReturn();
        conversationId = objectMapper.readTree(convResult.getResponse().getContentAsString()).get("id").asLong();
    }

    // ==================== PUBLIC KEY TESTS ====================

    @Test
    @Order(10)
    @DisplayName("Should publish a Kyber public key")
    void testPublishKyberKey() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "algorithm", "KYBER",
                "publicKey", Map.of("a", new int[]{1, 2, 3}, "t", new int[]{4, 5, 6})
        ));

        mockMvc.perform(post("/e2ee/conversations/" + conversationId + "/keys")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    @Order(11)
    @DisplayName("Should publish a Frodo public key")
    void testPublishFrodoKey() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "algorithm", "FRODO",
                "publicKey", Map.of("seedA", "abc123", "B", new int[][]{{1, 2}, {3, 4}})
        ));

        mockMvc.perform(post("/e2ee/conversations/" + conversationId + "/keys")
                        .header("Authorization", "Bearer " + bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    @Order(12)
    @DisplayName("Should update existing key on re-publish")
    void testUpdateExistingKey() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "algorithm", "KYBER",
                "publicKey", Map.of("a", new int[]{10, 20, 30}, "t", new int[]{40, 50, 60})
        ));

        mockMvc.perform(post("/e2ee/conversations/" + conversationId + "/keys")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    @Order(13)
    @DisplayName("Should retrieve published keys for a conversation")
    void testGetKeys() throws Exception {
        // Publish a key from Bob for KYBER
        String body = objectMapper.writeValueAsString(Map.of(
                "algorithm", "KYBER",
                "publicKey", Map.of("a", new int[]{7, 8, 9}, "t", new int[]{10, 11, 12})
        ));

        mockMvc.perform(post("/e2ee/conversations/" + conversationId + "/keys")
                        .header("Authorization", "Bearer " + bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        // Get Kyber keys
        mockMvc.perform(get("/e2ee/conversations/" + conversationId + "/keys")
                        .header("Authorization", "Bearer " + aliceToken)
                        .param("algorithm", "KYBER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.algorithm").value("KYBER"))
                .andExpect(jsonPath("$.keysByUser").exists())
                .andExpect(jsonPath("$.keysByUser.e2ee_alice").exists())
                .andExpect(jsonPath("$.keysByUser.e2ee_bob").exists());
    }

    @Test
    @Order(14)
    @DisplayName("Should filter keys by algorithm")
    void testGetKeysByAlgorithm() throws Exception {
        // Get Frodo keys - only Bob published Frodo
        mockMvc.perform(get("/e2ee/conversations/" + conversationId + "/keys")
                        .header("Authorization", "Bearer " + aliceToken)
                        .param("algorithm", "FRODO"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.algorithm").value("FRODO"))
                .andExpect(jsonPath("$.keysByUser.e2ee_bob").exists());
    }

    @Test
    @Order(15)
    @DisplayName("Should reject unauthenticated key publish")
    void testPublishKeyUnauthenticated() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "algorithm", "KYBER",
                "publicKey", Map.of("a", new int[]{1}, "t", new int[]{2})
        ));

        mockMvc.perform(post("/e2ee/conversations/" + conversationId + "/keys")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    // ==================== KEM ENVELOPE TESTS ====================

    @Test
    @Order(20)
    @DisplayName("Should send KEM ciphertext envelope")
    void testSendKemEnvelope() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "algorithm", "KYBER",
                "toUsername", "e2ee_bob",
                "ciphertext", Map.of("u", new int[]{1, 2, 3}, "v", new int[]{4, 5, 6})
        ));

        mockMvc.perform(post("/e2ee/conversations/" + conversationId + "/kem")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    @Order(21)
    @DisplayName("Should retrieve pending KEM envelopes")
    void testGetPendingKem() throws Exception {
        mockMvc.perform(get("/e2ee/conversations/" + conversationId + "/kem/pending")
                        .header("Authorization", "Bearer " + bobToken)
                        .param("algorithm", "KYBER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.algorithm").value("KYBER"))
                .andExpect(jsonPath("$.pending").isArray())
                .andExpect(jsonPath("$.pending", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.pending[0].fromUsername").value("e2ee_alice"))
                .andExpect(jsonPath("$.pending[0].ciphertext").exists());
    }

    @Test
    @Order(22)
    @DisplayName("Pending envelopes should be marked as delivered after retrieval")
    void testPendingMarkedDelivered() throws Exception {
        // Second call should return empty pending list
        mockMvc.perform(get("/e2ee/conversations/" + conversationId + "/kem/pending")
                        .header("Authorization", "Bearer " + bobToken)
                        .param("algorithm", "KYBER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pending", hasSize(0)));
    }

    @Test
    @Order(23)
    @DisplayName("Should not see pending envelopes for wrong user")
    void testPendingForWrongUser() throws Exception {
        // Send another envelope to Bob
        String body = objectMapper.writeValueAsString(Map.of(
                "algorithm", "KYBER",
                "toUsername", "e2ee_bob",
                "ciphertext", Map.of("u", new int[]{7, 8}, "v", new int[]{9, 10})
        ));

        mockMvc.perform(post("/e2ee/conversations/" + conversationId + "/kem")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        // Alice should not see Bob's pending envelopes
        mockMvc.perform(get("/e2ee/conversations/" + conversationId + "/kem/pending")
                        .header("Authorization", "Bearer " + aliceToken)
                        .param("algorithm", "KYBER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pending", hasSize(0)));
    }

    @Test
    @Order(24)
    @DisplayName("Should reject unauthenticated KEM send")
    void testSendKemUnauthenticated() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "algorithm", "KYBER",
                "toUsername", "e2ee_bob",
                "ciphertext", Map.of("u", new int[]{1}, "v", new int[]{2})
        ));

        mockMvc.perform(post("/e2ee/conversations/" + conversationId + "/kem")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(25)
    @DisplayName("Should handle NTRU algorithm KEM envelope")
    void testNtruKemEnvelope() throws Exception {
        // Publish NTRU key
        String keyBody = objectMapper.writeValueAsString(Map.of(
                "algorithm", "NTRU",
                "publicKey", Map.of("h", new int[]{1, 2, 3, 4, 5, 6, 7})
        ));

        mockMvc.perform(post("/e2ee/conversations/" + conversationId + "/keys")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(keyBody))
                .andExpect(status().isOk());

        // Send NTRU KEM envelope
        String kemBody = objectMapper.writeValueAsString(Map.of(
                "algorithm", "NTRU",
                "toUsername", "e2ee_bob",
                "ciphertext", Map.of("c", new int[]{10, 20, 30}, "encSeed", "base64encodedSeed")
        ));

        mockMvc.perform(post("/e2ee/conversations/" + conversationId + "/kem")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(kemBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));

        // Bob retrieves NTRU pending
        mockMvc.perform(get("/e2ee/conversations/" + conversationId + "/kem/pending")
                        .header("Authorization", "Bearer " + bobToken)
                        .param("algorithm", "NTRU"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.algorithm").value("NTRU"))
                .andExpect(jsonPath("$.pending", hasSize(1)))
                .andExpect(jsonPath("$.pending[0].algorithm").value("NTRU"));
    }
}
