package com.github.kof1016.aiworkflowdemo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class AdditionApiTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void addsTwoIntegers() throws Exception {
		mockMvc.perform(get("/add").param("a", "1").param("b", "2")).andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(content().json("{\"result\":\"3\"}"));
	}

	@Test
	void addsSignedIntegersBeyondMachineRangeAndReturnsCanonicalResult() throws Exception {
		mockMvc.perform(get("/add").param("a", "+0009223372036854775808").param("b", "-9223372036854775807"))
				.andExpect(status().isOk()).andExpect(content().json("{\"result\":\"1\"}"));
	}

	@Test
	void returnsCanonicalZero() throws Exception {
		mockMvc.perform(get("/add").param("a", "+0001").param("b", "-0001")).andExpect(status().isOk())
				.andExpect(content().json("{\"result\":\"0\"}"));
	}

	@Test
	void acceptsOneThousandDigitsAndReturnsExactOneThousandOneDigitResult() throws Exception {
		String thousandDigitOperand = "+" + "9".repeat(1_000);
		String expectedResult = "1" + "0".repeat(1_000);

		mockMvc.perform(get("/add").param("a", thousandDigitOperand).param("b", "1")).andExpect(status().isOk())
				.andExpect(content().json("{\"result\":\"" + expectedResult + "\"}"));
	}

	@ParameterizedTest
	@ValueSource(strings = {"a", "b"})
	void rejectsOperandsWhoseDigitPartExceedsOneThousandDigits(String parameterName) throws Exception {
		String overlongValue = "-" + "0".repeat(1_001);
		String a = parameterName.equals("a") ? overlongValue : "1";
		String b = parameterName.equals("b") ? overlongValue : "1";

		mockMvc.perform(get("/add").param("a", a).param("b", b)).andExpect(status().isBadRequest());
	}

	@ParameterizedTest
	@ValueSource(strings = {"", "1.0", "1e3", " 1", "1 ", "١"})
	void rejectsValuesThatAreNotAsciiDecimalIntegers(String invalidValue) throws Exception {
		mockMvc.perform(get("/add").param("a", invalidValue).param("b", "1")).andExpect(status().isBadRequest());
		mockMvc.perform(get("/add").param("a", "1").param("b", invalidValue)).andExpect(status().isBadRequest());
	}

	@Test
	void rejectsMissingParameters() throws Exception {
		mockMvc.perform(get("/add").param("a", "1")).andExpect(status().isBadRequest());
		mockMvc.perform(get("/add").param("b", "1")).andExpect(status().isBadRequest());
	}

}
