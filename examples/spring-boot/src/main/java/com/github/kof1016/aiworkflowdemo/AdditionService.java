package com.github.kof1016.aiworkflowdemo;

import org.springframework.stereotype.Service;

@Service
public class AdditionService {

	public int add(int a, int b) {
		return Math.addExact(a, b);
	}
}
