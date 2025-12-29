package com.messaging.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.messaging.backend.domain.Conversation;
import com.messaging.backend.domain.ConversationE2eeKey;
import com.messaging.backend.domain.ConversationKemEnvelope;
import com.messaging.backend.pqc.dto.E2eeDtos;
import com.messaging.backend.repository.ConversationE2eeKeyRepository;
import com.messaging.backend.repository.ConversationKemEnvelopeRepository;
import com.messaging.backend.repository.ConversationRepository;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.*;

@RestController
@RequestMapping("/e2ee")
public class E2eeController {

    private final ConversationRepository conversations;
    private final ConversationE2eeKeyRepository keys;
    private final ConversationKemEnvelopeRepository kem;
    private final ObjectMapper mapper = new ObjectMapper();

    public E2eeController(
            ConversationRepository conversations,
            ConversationE2eeKeyRepository keys,
            ConversationKemEnvelopeRepository kem
    ) {
        this.conversations = conversations;
        this.keys = keys;
        this.kem = kem;
    }

    @PostMapping("/conversations/{conversationId}/keys")
    public E2eeDtos.PublishKeyResponse publishKey(
            @PathVariable Long conversationId,
            @RequestBody E2eeDtos.PublishKeyRequest req,
            Principal principal
    ) throws Exception {
        if (principal == null) throw new RuntimeException("Unauthenticated");

        String me = principal.getName();
        Conversation c = conversations.findById(conversationId).orElseThrow();

        String alg = (req.algorithm == null || req.algorithm.isBlank()) ? "KYBER" : req.algorithm.toUpperCase(Locale.ROOT);
        String json = mapper.writeValueAsString(req.publicKey);

        ConversationE2eeKey key = keys
                .findByConversationIdAndOwnerUsernameAndAlgorithm(conversationId, me, alg)
                .orElse(null);

        if (key == null) {
            keys.save(new ConversationE2eeKey(c, me, alg, json));
        } else {
            key.setPublicKeyJson(json);
            keys.save(key);
        }

        E2eeDtos.PublishKeyResponse res = new E2eeDtos.PublishKeyResponse();
        res.status = "ok";
        return res;
    }

    @GetMapping("/conversations/{conversationId}/keys")
    public E2eeDtos.GetKeysResponse getKeys(
            @PathVariable Long conversationId,
            @RequestParam(defaultValue = "KYBER") String algorithm
    ) throws Exception {
        String alg = algorithm.toUpperCase(Locale.ROOT);
        List<ConversationE2eeKey> list = keys.findByConversationId(conversationId);

        Map<String, Map<String, Object>> out = new HashMap<>();
        for (ConversationE2eeKey k : list) {
            if (!alg.equalsIgnoreCase(k.getAlgorithm())) continue;
            Map<String, Object> pk = mapper.readValue(k.getPublicKeyJson(), new TypeReference<Map<String, Object>>() {});
            out.put(k.getOwnerUsername(), pk);
        }

        E2eeDtos.GetKeysResponse res = new E2eeDtos.GetKeysResponse();
        res.algorithm = alg;
        res.keysByUser = out;
        return res;
    }

    @PostMapping("/conversations/{conversationId}/kem")
    public E2eeDtos.SendKemResponse sendKem(
            @PathVariable Long conversationId,
            @RequestBody E2eeDtos.SendKemRequest req,
            Principal principal
    ) throws Exception {
        if (principal == null) throw new RuntimeException("Unauthenticated");

        String me = principal.getName();
        Conversation c = conversations.findById(conversationId).orElseThrow();

        String alg = (req.algorithm == null || req.algorithm.isBlank()) ? "KYBER" : req.algorithm.toUpperCase(Locale.ROOT);
        String ctJson = mapper.writeValueAsString(req.ciphertext);

        kem.save(new ConversationKemEnvelope(c, me, req.toUsername, alg, ctJson));

        E2eeDtos.SendKemResponse res = new E2eeDtos.SendKemResponse();
        res.status = "ok";
        return res;
    }

    @GetMapping("/conversations/{conversationId}/kem/pending")
    public E2eeDtos.PendingKemResponse pendingKem(
            @PathVariable Long conversationId,
            @RequestParam(defaultValue = "KYBER") String algorithm,
            Principal principal
    ) throws Exception {
        if (principal == null) throw new RuntimeException("Unauthenticated");

        String me = principal.getName();
        String alg = algorithm.toUpperCase(Locale.ROOT);

        List<ConversationKemEnvelope> list = kem.findByConversationIdAndToUsernameAndDeliveredFalse(conversationId, me);

        List<E2eeDtos.PendingKemItem> items = new ArrayList<>();
        for (ConversationKemEnvelope e : list) {
            if (!alg.equalsIgnoreCase(e.getAlgorithm())) continue;

            Map<String, Object> ct = mapper.readValue(e.getCiphertextJson(), new TypeReference<Map<String, Object>>() {});
            E2eeDtos.PendingKemItem it = new E2eeDtos.PendingKemItem();
            it.id = e.getId();
            it.algorithm = e.getAlgorithm();
            it.fromUsername = e.getFromUsername();
            it.ciphertext = ct;
            items.add(it);

            e.setDelivered(true);
            kem.save(e);
        }

        E2eeDtos.PendingKemResponse res = new E2eeDtos.PendingKemResponse();
        res.algorithm = alg;
        res.pending = items;
        return res;
    }
}