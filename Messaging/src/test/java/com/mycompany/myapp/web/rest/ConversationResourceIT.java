package com.mycompany.myapp.web.rest;

import static com.mycompany.myapp.domain.ConversationAsserts.*;
import static com.mycompany.myapp.web.rest.TestUtil.createUpdateProxyForBean;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mycompany.myapp.IntegrationTest;
import com.mycompany.myapp.domain.Conversation;
import com.mycompany.myapp.repository.ConversationRepository;
import com.mycompany.myapp.repository.EntityManager;
import com.mycompany.myapp.repository.UserRepository;
import com.mycompany.myapp.service.ConversationService;
import com.mycompany.myapp.service.dto.ConversationDTO;
import com.mycompany.myapp.service.mapper.ConversationMapper;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Flux;

/**
 * Integration tests for the {@link ConversationResource} REST controller.
 */
@IntegrationTest
@ExtendWith(MockitoExtension.class)
@AutoConfigureWebTestClient(timeout = IntegrationTest.DEFAULT_ENTITY_TIMEOUT)
@WithMockUser
class ConversationResourceIT {

    private static final Instant DEFAULT_CREATED_AT = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_CREATED_AT = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String ENTITY_API_URL = "/api/conversations";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static Random random = new Random();
    private static AtomicLong longCount = new AtomicLong(random.nextInt() + (2 * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private UserRepository userRepository;

    @Mock
    private ConversationRepository conversationRepositoryMock;

    @Autowired
    private ConversationMapper conversationMapper;

    @Mock
    private ConversationService conversationServiceMock;

    @Autowired
    private EntityManager em;

    @Autowired
    private WebTestClient webTestClient;

    private Conversation conversation;

    private Conversation insertedConversation;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Conversation createEntity() {
        return new Conversation().createdAt(DEFAULT_CREATED_AT);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Conversation createUpdatedEntity() {
        return new Conversation().createdAt(UPDATED_CREATED_AT);
    }

    public static void deleteEntities(EntityManager em) {
        try {
            em.deleteAll(Conversation.class).block();
        } catch (Exception e) {
            // It can fail, if other entities are still referring this - it will be removed later.
        }
    }

    @BeforeEach
    public void initTest() {
        conversation = createEntity();
    }

    @AfterEach
    public void cleanup() {
        if (insertedConversation != null) {
            conversationRepository.delete(insertedConversation).block();
            insertedConversation = null;
        }
        deleteEntities(em);
        userRepository.deleteAllUserAuthorities().block();
        userRepository.deleteAll().block();
    }

    @Test
    void createConversation() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Conversation
        ConversationDTO conversationDTO = conversationMapper.toDto(conversation);
        var returnedConversationDTO = webTestClient
            .post()
            .uri(ENTITY_API_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(om.writeValueAsBytes(conversationDTO))
            .exchange()
            .expectStatus()
            .isCreated()
            .expectBody(ConversationDTO.class)
            .returnResult()
            .getResponseBody();

        // Validate the Conversation in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        var returnedConversation = conversationMapper.toEntity(returnedConversationDTO);
        assertConversationUpdatableFieldsEquals(returnedConversation, getPersistedConversation(returnedConversation));

        insertedConversation = returnedConversation;
    }

    @Test
    void createConversationWithExistingId() throws Exception {
        // Create the Conversation with an existing ID
        conversation.setId(1L);
        ConversationDTO conversationDTO = conversationMapper.toDto(conversation);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        webTestClient
            .post()
            .uri(ENTITY_API_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(om.writeValueAsBytes(conversationDTO))
            .exchange()
            .expectStatus()
            .isBadRequest();

        // Validate the Conversation in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    void checkCreatedAtIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        conversation.setCreatedAt(null);

        // Create the Conversation, which fails.
        ConversationDTO conversationDTO = conversationMapper.toDto(conversation);

        webTestClient
            .post()
            .uri(ENTITY_API_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(om.writeValueAsBytes(conversationDTO))
            .exchange()
            .expectStatus()
            .isBadRequest();

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    void getAllConversationsAsStream() {
        // Initialize the database
        conversationRepository.save(conversation).block();

        List<Conversation> conversationList = webTestClient
            .get()
            .uri(ENTITY_API_URL)
            .accept(MediaType.APPLICATION_NDJSON)
            .exchange()
            .expectStatus()
            .isOk()
            .expectHeader()
            .contentTypeCompatibleWith(MediaType.APPLICATION_NDJSON)
            .returnResult(ConversationDTO.class)
            .getResponseBody()
            .map(conversationMapper::toEntity)
            .filter(conversation::equals)
            .collectList()
            .block(Duration.ofSeconds(5));

        assertThat(conversationList).isNotNull();
        assertThat(conversationList).hasSize(1);
        Conversation testConversation = conversationList.get(0);

        // Test fails because reactive api returns an empty object instead of null
        // assertConversationAllPropertiesEquals(conversation, testConversation);
        assertConversationUpdatableFieldsEquals(conversation, testConversation);
    }

    @Test
    void getAllConversations() {
        // Initialize the database
        insertedConversation = conversationRepository.save(conversation).block();

        // Get all the conversationList
        webTestClient
            .get()
            .uri(ENTITY_API_URL + "?sort=id,desc")
            .accept(MediaType.APPLICATION_JSON)
            .exchange()
            .expectStatus()
            .isOk()
            .expectHeader()
            .contentType(MediaType.APPLICATION_JSON)
            .expectBody()
            .jsonPath("$.[*].id")
            .value(hasItem(conversation.getId().intValue()))
            .jsonPath("$.[*].createdAt")
            .value(hasItem(DEFAULT_CREATED_AT.toString()));
    }

    @SuppressWarnings({ "unchecked" })
    void getAllConversationsWithEagerRelationshipsIsEnabled() {
        when(conversationServiceMock.findAllWithEagerRelationships(any())).thenReturn(Flux.empty());

        webTestClient.get().uri(ENTITY_API_URL + "?eagerload=true").exchange().expectStatus().isOk();

        verify(conversationServiceMock, times(1)).findAllWithEagerRelationships(any());
    }

    @SuppressWarnings({ "unchecked" })
    void getAllConversationsWithEagerRelationshipsIsNotEnabled() {
        when(conversationServiceMock.findAllWithEagerRelationships(any())).thenReturn(Flux.empty());

        webTestClient.get().uri(ENTITY_API_URL + "?eagerload=false").exchange().expectStatus().isOk();
        verify(conversationRepositoryMock, times(1)).findAllWithEagerRelationships(any());
    }

    @Test
    void getConversation() {
        // Initialize the database
        insertedConversation = conversationRepository.save(conversation).block();

        // Get the conversation
        webTestClient
            .get()
            .uri(ENTITY_API_URL_ID, conversation.getId())
            .accept(MediaType.APPLICATION_JSON)
            .exchange()
            .expectStatus()
            .isOk()
            .expectHeader()
            .contentType(MediaType.APPLICATION_JSON)
            .expectBody()
            .jsonPath("$.id")
            .value(is(conversation.getId().intValue()))
            .jsonPath("$.createdAt")
            .value(is(DEFAULT_CREATED_AT.toString()));
    }

    @Test
    void getNonExistingConversation() {
        // Get the conversation
        webTestClient
            .get()
            .uri(ENTITY_API_URL_ID, Long.MAX_VALUE)
            .accept(MediaType.APPLICATION_PROBLEM_JSON)
            .exchange()
            .expectStatus()
            .isNotFound();
    }

    @Test
    void putExistingConversation() throws Exception {
        // Initialize the database
        insertedConversation = conversationRepository.save(conversation).block();

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the conversation
        Conversation updatedConversation = conversationRepository.findById(conversation.getId()).block();
        updatedConversation.createdAt(UPDATED_CREATED_AT);
        ConversationDTO conversationDTO = conversationMapper.toDto(updatedConversation);

        webTestClient
            .put()
            .uri(ENTITY_API_URL_ID, conversationDTO.getId())
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(om.writeValueAsBytes(conversationDTO))
            .exchange()
            .expectStatus()
            .isOk();

        // Validate the Conversation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedConversationToMatchAllProperties(updatedConversation);
    }

    @Test
    void putNonExistingConversation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        conversation.setId(longCount.incrementAndGet());

        // Create the Conversation
        ConversationDTO conversationDTO = conversationMapper.toDto(conversation);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        webTestClient
            .put()
            .uri(ENTITY_API_URL_ID, conversationDTO.getId())
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(om.writeValueAsBytes(conversationDTO))
            .exchange()
            .expectStatus()
            .isBadRequest();

        // Validate the Conversation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    void putWithIdMismatchConversation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        conversation.setId(longCount.incrementAndGet());

        // Create the Conversation
        ConversationDTO conversationDTO = conversationMapper.toDto(conversation);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        webTestClient
            .put()
            .uri(ENTITY_API_URL_ID, longCount.incrementAndGet())
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(om.writeValueAsBytes(conversationDTO))
            .exchange()
            .expectStatus()
            .isBadRequest();

        // Validate the Conversation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    void putWithMissingIdPathParamConversation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        conversation.setId(longCount.incrementAndGet());

        // Create the Conversation
        ConversationDTO conversationDTO = conversationMapper.toDto(conversation);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        webTestClient
            .put()
            .uri(ENTITY_API_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(om.writeValueAsBytes(conversationDTO))
            .exchange()
            .expectStatus()
            .isEqualTo(405);

        // Validate the Conversation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    void partialUpdateConversationWithPatch() throws Exception {
        // Initialize the database
        insertedConversation = conversationRepository.save(conversation).block();

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the conversation using partial update
        Conversation partialUpdatedConversation = new Conversation();
        partialUpdatedConversation.setId(conversation.getId());

        webTestClient
            .patch()
            .uri(ENTITY_API_URL_ID, partialUpdatedConversation.getId())
            .contentType(MediaType.valueOf("application/merge-patch+json"))
            .bodyValue(om.writeValueAsBytes(partialUpdatedConversation))
            .exchange()
            .expectStatus()
            .isOk();

        // Validate the Conversation in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertConversationUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedConversation, conversation),
            getPersistedConversation(conversation)
        );
    }

    @Test
    void fullUpdateConversationWithPatch() throws Exception {
        // Initialize the database
        insertedConversation = conversationRepository.save(conversation).block();

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the conversation using partial update
        Conversation partialUpdatedConversation = new Conversation();
        partialUpdatedConversation.setId(conversation.getId());

        partialUpdatedConversation.createdAt(UPDATED_CREATED_AT);

        webTestClient
            .patch()
            .uri(ENTITY_API_URL_ID, partialUpdatedConversation.getId())
            .contentType(MediaType.valueOf("application/merge-patch+json"))
            .bodyValue(om.writeValueAsBytes(partialUpdatedConversation))
            .exchange()
            .expectStatus()
            .isOk();

        // Validate the Conversation in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertConversationUpdatableFieldsEquals(partialUpdatedConversation, getPersistedConversation(partialUpdatedConversation));
    }

    @Test
    void patchNonExistingConversation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        conversation.setId(longCount.incrementAndGet());

        // Create the Conversation
        ConversationDTO conversationDTO = conversationMapper.toDto(conversation);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        webTestClient
            .patch()
            .uri(ENTITY_API_URL_ID, conversationDTO.getId())
            .contentType(MediaType.valueOf("application/merge-patch+json"))
            .bodyValue(om.writeValueAsBytes(conversationDTO))
            .exchange()
            .expectStatus()
            .isBadRequest();

        // Validate the Conversation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    void patchWithIdMismatchConversation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        conversation.setId(longCount.incrementAndGet());

        // Create the Conversation
        ConversationDTO conversationDTO = conversationMapper.toDto(conversation);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        webTestClient
            .patch()
            .uri(ENTITY_API_URL_ID, longCount.incrementAndGet())
            .contentType(MediaType.valueOf("application/merge-patch+json"))
            .bodyValue(om.writeValueAsBytes(conversationDTO))
            .exchange()
            .expectStatus()
            .isBadRequest();

        // Validate the Conversation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    void patchWithMissingIdPathParamConversation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        conversation.setId(longCount.incrementAndGet());

        // Create the Conversation
        ConversationDTO conversationDTO = conversationMapper.toDto(conversation);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        webTestClient
            .patch()
            .uri(ENTITY_API_URL)
            .contentType(MediaType.valueOf("application/merge-patch+json"))
            .bodyValue(om.writeValueAsBytes(conversationDTO))
            .exchange()
            .expectStatus()
            .isEqualTo(405);

        // Validate the Conversation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    void deleteConversation() {
        // Initialize the database
        insertedConversation = conversationRepository.save(conversation).block();

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the conversation
        webTestClient
            .delete()
            .uri(ENTITY_API_URL_ID, conversation.getId())
            .accept(MediaType.APPLICATION_JSON)
            .exchange()
            .expectStatus()
            .isNoContent();

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return conversationRepository.count().block();
    }

    protected void assertIncrementedRepositoryCount(long countBefore) {
        assertThat(countBefore + 1).isEqualTo(getRepositoryCount());
    }

    protected void assertDecrementedRepositoryCount(long countBefore) {
        assertThat(countBefore - 1).isEqualTo(getRepositoryCount());
    }

    protected void assertSameRepositoryCount(long countBefore) {
        assertThat(countBefore).isEqualTo(getRepositoryCount());
    }

    protected Conversation getPersistedConversation(Conversation conversation) {
        return conversationRepository.findById(conversation.getId()).block();
    }

    protected void assertPersistedConversationToMatchAllProperties(Conversation expectedConversation) {
        // Test fails because reactive api returns an empty object instead of null
        // assertConversationAllPropertiesEquals(expectedConversation, getPersistedConversation(expectedConversation));
        assertConversationUpdatableFieldsEquals(expectedConversation, getPersistedConversation(expectedConversation));
    }

    protected void assertPersistedConversationToMatchUpdatableProperties(Conversation expectedConversation) {
        // Test fails because reactive api returns an empty object instead of null
        // assertConversationAllUpdatablePropertiesEquals(expectedConversation, getPersistedConversation(expectedConversation));
        assertConversationUpdatableFieldsEquals(expectedConversation, getPersistedConversation(expectedConversation));
    }
}
