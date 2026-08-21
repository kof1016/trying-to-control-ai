package com.github.kof1016.aiworkflowdemo.addition;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
class AdditionRequestMappingExceptionHandler {

	@ExceptionHandler(HttpMediaTypeNotSupportedException.class)
	ResponseEntity<ProblemDetail> unsupportedMediaType(HttpMediaTypeNotSupportedException exception,
			HttpServletRequest request) throws Exception {
		requireAdditionEndpoint(request, exception);
		return AdditionExceptionHandler.problem(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
				"Content-Type must be application/json.", "UNSUPPORTED_MEDIA_TYPE", request);
	}

	@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
	ResponseEntity<ProblemDetail> methodNotAllowed(HttpRequestMethodNotSupportedException exception,
			HttpServletRequest request) throws Exception {
		requireAdditionEndpoint(request, exception);
		return AdditionExceptionHandler.problem(HttpStatus.METHOD_NOT_ALLOWED,
				"The /api/add endpoint only supports POST.", "METHOD_NOT_ALLOWED", request);
	}

	private void requireAdditionEndpoint(HttpServletRequest request, Exception exception) throws Exception {
		if (!"/api/add".equals(request.getRequestURI())) {
			throw exception;
		}
	}
}
