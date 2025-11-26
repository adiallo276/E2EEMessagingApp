package com.mycompany.myapp.service.mapper;

import com.mycompany.myapp.domain.Conversation;
import com.mycompany.myapp.domain.User;
import com.mycompany.myapp.service.dto.ConversationDTO;
import com.mycompany.myapp.service.dto.UserDTO;
import org.mapstruct.*;

/**
 * Mapper for the entity {@link Conversation} and its DTO {@link ConversationDTO}.
 */
@Mapper(componentModel = "spring")
public interface ConversationMapper extends EntityMapper<ConversationDTO, Conversation> {
    @Mapping(target = "user1", source = "user1", qualifiedByName = "userLogin")
    @Mapping(target = "user2", source = "user2", qualifiedByName = "userLogin")
    ConversationDTO toDto(Conversation s);

    @Named("userLogin")
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "id", source = "id")
    @Mapping(target = "login", source = "login")
    UserDTO toDtoUserLogin(User user);
}
