package com.github.kof1016.aiworkflowdemo.addition;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class AdditionApiTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void addsTwoIntegers() throws Exception {
		mockMvc.perform(post("/api/add").contentType(MediaType.APPLICATION_JSON).content("""
				{"a":2,"b":3}
				""")).andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.result").value(5));
	}

	@Test
	void acceptsScientificNotationThatExactlyRepresentsIntegers() throws Exception {
		mockMvc.perform(post("/api/add").contentType(MediaType.APPLICATION_JSON).content("""
				{"a":2e1,"b":-3}
				""")).andExpect(status().isOk()).andExpect(jsonPath("$.result").value(17));
	}

	@ParameterizedTest(name = "{0}")
	@MethodSource("invalidOperands")
	void rejectsInvalidOperands(String description, String body) throws Exception {
		mockMvc.perform(post("/api/add").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.type").value("about:blank")).andExpect(jsonPath("$.title").value("Bad Request"))
				.andExpect(jsonPath("$.status").value(400)).andExpect(jsonPath("$.detail").exists())
				.andExpect(jsonPath("$.instance").value("/api/add"))
				.andExpect(jsonPath("$.code").value("INVALID_OPERAND"));
	}

	@ParameterizedTest
	@MethodSource("overflowRequests")
	void rejectsIntegerOverflow(String body) throws Exception {
		assertProblem(mockMvc.perform(post("/api/add").contentType(MediaType.APPLICATION_JSON).content(body)), 400,
				"Bad Request", "INTEGER_OVERFLOW");
	}

	@Test
	void rejectsMissingOrUnsupportedContentType() throws Exception {
		assertProblem(mockMvc.perform(post("/api/add").content("{\"a\":1,\"b\":2}")), 415, "Unsupported Media Type",
				"UNSUPPORTED_MEDIA_TYPE");
		assertProblem(mockMvc.perform(post("/api/add").contentType(MediaType.TEXT_PLAIN).content("{\"a\":1,\"b\":2}")),
				415, "Unsupported Media Type", "UNSUPPORTED_MEDIA_TYPE");
	}

	@Test
	void rejectsMethodsOtherThanPost() throws Exception {
		assertMethodNotAllowed(mockMvc.perform(get("/api/add")));
		assertMethodNotAllowed(mockMvc.perform(head("/api/add")));
		assertMethodNotAllowed(mockMvc.perform(options("/api/add")));
		assertMethodNotAllowed(mockMvc.perform(put("/api/add")));
		assertMethodNotAllowed(mockMvc.perform(patch("/api/add")));
		assertMethodNotAllowed(mockMvc.perform(delete("/api/add")));
	}

	private void assertMethodNotAllowed(ResultActions result) throws Exception {
		assertProblem(result, 405, "Method Not Allowed", "METHOD_NOT_ALLOWED");
	}

	private void assertProblem(ResultActions result, int status, String title, String code) throws Exception {
		result.andExpect(status().is(status))
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.type").value("about:blank")).andExpect(jsonPath("$.title").value(title))
				.andExpect(jsonPath("$.status").value(status)).andExpect(jsonPath("$.detail").exists())
				.andExpect(jsonPath("$.instance").value("/api/add")).andExpect(jsonPath("$.code").value(code));
	}

	private static Stream<String> overflowRequests() {
		return Stream.of("{\"a\":2147483647,\"b\":1}", "{\"a\":-2147483648,\"b\":-1}");
	}

	private static Stream<Arguments> invalidOperands() {
		return Stream.of(Arguments.of("empty body", ""), Arguments.of("malformed JSON", "{"),
				Arguments.of("multiple JSON values", "{\"a\":1,\"b\":2} {}"), Arguments.of("array body", "[]"),
				Arguments.of("null body", "null"), Arguments.of("string body", "\"text\""),
				Arguments.of("missing field", "{\"a\":1}"), Arguments.of("null operand", "{\"a\":1,\"b\":null}"),
				Arguments.of("case-mismatched field", "{\"A\":1,\"b\":2}"),
				Arguments.of("unknown field", "{\"a\":1,\"b\":2,\"c\":3}"),
				Arguments.of("duplicate field", "{\"a\":1,\"a\":2,\"b\":3}"),
				Arguments.of("string operand", "{\"a\":\"1\",\"b\":2}"),
				Arguments.of("decimal operand", "{\"a\":1.5,\"b\":2}"),
				Arguments.of("non-integral scientific notation", "{\"a\":2e-1,\"b\":3}"),
				Arguments.of("out-of-range operand", "{\"a\":2147483648,\"b\":0}"));
	}
}
