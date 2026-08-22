package com.github.kof1016.aiworkflowdemo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class AdditionServiceTests {

	private final AdditionService additionService = new AdditionService();

	@Test
	void addsTwoIntegers() {
		assertEquals(5, additionService.add(2, 3));
	}

	@Test
	void addsNegativeIntegers() {
		assertEquals(-3, additionService.add(-4, 1));
	}

	@Test
	void addsZero() {
		assertEquals(3, additionService.add(0, 3));
	}

	@Test
	void rejectsOverflow() {
		assertThrows(ArithmeticException.class, () -> additionService.add(Integer.MAX_VALUE, 1));
	}

	@Test
	void rejectsUnderflow() {
		assertThrows(ArithmeticException.class, () -> additionService.add(Integer.MIN_VALUE, -1));
	}
}
