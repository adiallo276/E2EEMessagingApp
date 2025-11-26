package com.mycompany.myapp.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class MessageTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2 * Integer.MAX_VALUE));

    public static Message getMessageSample1() {
        return new Message().id(1L).content("content1");
    }

    public static Message getMessageSample2() {
        return new Message().id(2L).content("content2");
    }

    public static Message getMessageRandomSampleGenerator() {
        return new Message().id(longCount.incrementAndGet()).content(UUID.randomUUID().toString());
    }
}
