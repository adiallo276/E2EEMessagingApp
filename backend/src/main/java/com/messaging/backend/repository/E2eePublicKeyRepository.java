package com.messaging.backend.repository;

import com.messaging.backend.domain.E2eePublicKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface E2eePublicKeyRepository extends JpaRepository<E2eePublicKey, Long> {
    Optional<E2eePublicKey> findByUsername(String username);
}