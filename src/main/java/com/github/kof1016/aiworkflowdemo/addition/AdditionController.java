package com.github.kof1016.aiworkflowdemo.addition;

import java.util.List;

import tools.jackson.core.JacksonException;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import org.springframework.http.MediaType;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/add")
public class AdditionController {

	private final AdditionService additionService;
	private final ObjectMapper objectMapper;

	public AdditionController(AdditionService additionService, ObjectMapper objectMapper) {
		this.additionService = additionService;
		this.objectMapper = objectMapper;
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public AddResponse add(@RequestBody(required = false) String body) {
		AddRequest request = parseRequest(body);
		return new AddResponse(additionService.add(request.a(), request.b()));
	}

	@RequestMapping(method = RequestMethod.OPTIONS)
	void rejectOptions() throws HttpRequestMethodNotSupportedException {
		throw new HttpRequestMethodNotSupportedException("OPTIONS", List.of("POST"));
	}

	private AddRequest parseRequest(String body) {
		if (body == null || body.isBlank()) {
			throw new InvalidOperandException("Request body must be a JSON object.");
		}

		try {
			JsonNode root = objectMapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION).readTree(body);
			if (root == null || !root.isObject() || root.size() != 2 || !root.has("a") || !root.has("b")) {
				throw new InvalidOperandException("Request must contain exactly the fields 'a' and 'b'.");
			}
			return new AddRequest(exactInt(root.get("a")), exactInt(root.get("b")));
		} catch (JacksonException exception) {
			throw new InvalidOperandException("Request body is not valid JSON.", exception);
		}
	}

	private int exactInt(JsonNode operand) {
		if (operand == null || !operand.isNumber()) {
			throw new InvalidOperandException("Operands must be JSON numbers representing 32-bit integers.");
		}
		try {
			return operand.decimalValue().intValueExact();
		} catch (ArithmeticException exception) {
			throw new InvalidOperandException("Operands must be exact 32-bit integers.", exception);
		}
	}

	record AddRequest(int a, int b) {
	}

	record AddResponse(int result) {
	}
}
