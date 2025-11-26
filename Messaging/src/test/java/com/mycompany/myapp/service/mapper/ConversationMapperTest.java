package com.mycompany.myapp.service.mapper;

import static com.mycompany.myapp.domain.ConversationAsserts.*;
import static com.mycompany.myapp.domain.ConversationTestSamples.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ConversationMapperTest {

    private ConversationMapper conversationMapper;

    @BeforeEach
    void setUp() {
        conversationMapper = new ConversationMapperImpl();
    }

    @Test
    void shouldConvertToDtoAndBack() {
        var expected = getConversationSample1();
        var actual = conversationMapper.toEntity(conversationMapper.toDto(expected));
        assertConversationAllPropertiesEquals(expected, actual);
    }
}
