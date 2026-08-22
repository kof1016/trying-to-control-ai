package com.github.kof1016.aiworkflowdemo;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;

@RestController
public class AdditionController {

	private final AdditionService additionService;

	public AdditionController(AdditionService additionService) {
		this.additionService = additionService;
	}

	@GetMapping("/add")
	AdditionResponse add(@RequestParam int a, @RequestParam int b) {
		return new AdditionResponse(additionService.add(a, b));
	}

	@ExceptionHandler(ArithmeticException.class)
	@ResponseStatus(HttpStatus.BAD_REQUEST)
	void handleOverflow() {
	}
}

record AdditionResponse(int result) {
}
