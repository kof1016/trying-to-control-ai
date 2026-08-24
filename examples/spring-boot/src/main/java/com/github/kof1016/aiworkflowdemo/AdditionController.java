package com.github.kof1016.aiworkflowdemo;

import java.math.BigInteger;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
class AdditionController {
	private static final Pattern DECIMAL_INTEGER = Pattern.compile("[+-]?[0-9]{1,1000}");

	@GetMapping("/add")
	Map<String, String> add(@RequestParam String a, @RequestParam String b) {
		return Map.of("result", parse(a).add(parse(b)).toString());
	}

	private BigInteger parse(String value) {
		if (!DECIMAL_INTEGER.matcher(value).matches()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
		}
		return new BigInteger(value);
	}

}
