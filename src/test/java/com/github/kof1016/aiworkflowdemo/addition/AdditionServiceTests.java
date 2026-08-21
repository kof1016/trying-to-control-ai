package com.github.kof1016.aiworkflowdemo.addition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class AdditionServiceTests {

	private final AdditionService additionService = new AdditionService();

	@ParameterizedTest
	@CsvSource({"2, 3, 5", "-2, 3, 1", "0, 0, 0", "-5, -7, -12", "2147483647, 0, 2147483647",
			"-2147483648, 0, -2147483648"})
	void addsIntegersWithoutOverflow(int a, int b, int expected) {
		assertThat(additionService.add(a, b)).isEqualTo(expected);
	}

	@Test
	void rejectsResultsOutsideTheSigned32BitRange() {
		assertThatThrownBy(() -> additionService.add(Integer.MAX_VALUE, 1)).isInstanceOf(ArithmeticException.class);
		assertThatThrownBy(() -> additionService.add(Integer.MIN_VALUE, -1)).isInstanceOf(ArithmeticException.class);
	}
}
