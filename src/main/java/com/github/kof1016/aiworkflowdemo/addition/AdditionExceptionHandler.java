package com.github.kof1016.aiworkflowdemo.addition;

import java.net.URI;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = AdditionController.class)
class AdditionExceptionHandler {

	@ExceptionHandler(InvalidOperandException.class)
	ResponseEntity<ProblemDetail> invalidOperand(InvalidOperandException exception, HttpServletRequest request) {
		return problem(HttpStatus.BAD_REQUEST, exception.getMessage(), "INVALID_OPERAND", request);
	}

	@ExceptionHandler(ArithmeticException.class)
	ResponseEntity<ProblemDetail> integerOverflow(ArithmeticException exception, HttpServletRequest request) {
		return problem(HttpStatus.BAD_REQUEST, "The addition result is outside the 32-bit signed integer range.",
				"INTEGER_OVERFLOW", request);
	}

	static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail, String code,
			HttpServletRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setType(URI.create("about:blank"));
		problem.setTitle(status.getReasonPhrase());
		problem.setInstance(URI.create(request.getRequestURI()));
		problem.setProperty("code", code);
		return ResponseEntity.status(status).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(problem);
	}
}
