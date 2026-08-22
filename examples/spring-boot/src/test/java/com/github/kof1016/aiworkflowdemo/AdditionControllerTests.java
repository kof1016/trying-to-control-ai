package com.github.kof1016.aiworkflowdemo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class AdditionControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void returnsTheSum() throws Exception {
		mockMvc.perform(get("/add").param("a", "2").param("b", "3")).andExpect(status().isOk())
				.andExpect(jsonPath("$.result").value(5));
	}

	@Test
	void returnsTheSumForANegativeOperand() throws Exception {
		mockMvc.perform(get("/add").param("a", "-4").param("b", "1")).andExpect(status().isOk())
				.andExpect(jsonPath("$.result").value(-3));
	}

	@Test
	void returnsTheSumForAZeroOperand() throws Exception {
		mockMvc.perform(get("/add").param("a", "0").param("b", "3")).andExpect(status().isOk())
				.andExpect(jsonPath("$.result").value(3));
	}

	@Test
	void rejectsAMissingFirstOperand() throws Exception {
		mockMvc.perform(get("/add").param("b", "3")).andExpect(status().isBadRequest());
	}

	@Test
	void rejectsAMissingSecondOperand() throws Exception {
		mockMvc.perform(get("/add").param("a", "2")).andExpect(status().isBadRequest());
	}

	@Test
	void rejectsANonIntegerOperand() throws Exception {
		mockMvc.perform(get("/add").param("a", "two").param("b", "3")).andExpect(status().isBadRequest());
	}

	@Test
	void rejectsOverflow() throws Exception {
		mockMvc.perform(get("/add").param("a", String.valueOf(Integer.MAX_VALUE)).param("b", "1"))
				.andExpect(status().isBadRequest());
	}
}
