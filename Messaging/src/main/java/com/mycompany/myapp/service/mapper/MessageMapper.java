package com.mycompany.myapp.service.mapper;

import com.mycompany.myapp.domain.Conversation;
import com.mycompany.myapp.domain.Message;
import com.mycompany.myapp.domain.User;
import com.mycompany.myapp.service.dto.ConversationDTO;
import com.mycompany.myapp.service.dto.MessageDTO;
import com.mycompany.myapp.service.dto.UserDTO;
import org.mapstruct.*;

/**
 * Mapper for the entity {@link Message} and its DTO {@link MessageDTO}.
 */
@Mapper(componentModel = "spring")
public interface MessageMapper extends EntityMapper<MessageDTO, Message> {
    @Mapping(target = "conversation", source = "conversation", qualifiedByName = "conversationId")
    @Mapping(target = "sender", source = "sender", qualifiedByName = "userLogin")
    MessageDTO toDto(Message s);

    @Named("conversationId")
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "id", source = "id")
    ConversationDTO toDtoConversationId(Conversation conversation);

    @Named("userLogin")
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "id", source = "id")
    @Mapping(target = "login", source = "login")
    UserDTO toDtoUserLogin(User user);
}
