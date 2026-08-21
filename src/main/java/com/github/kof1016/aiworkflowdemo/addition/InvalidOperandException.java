package com.github.kof1016.aiworkflowdemo.addition;

class InvalidOperandException extends RuntimeException {

	private static final long serialVersionUID = 1L;

	InvalidOperandException(String message) {
		super(message);
	}

	InvalidOperandException(String message, Throwable cause) {
		super(message, cause);
	}
}
