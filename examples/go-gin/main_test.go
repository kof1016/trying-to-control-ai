package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestAddsTwoIntegers(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/add?a=1&b=2", nil)
	response := httptest.NewRecorder()

	newRouter().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if response.Header().Get("Content-Type") != "application/json; charset=utf-8" {
		t.Fatalf("expected JSON content type, got %q", response.Header().Get("Content-Type"))
	}
	if response.Body.String() != "{\"result\":\"3\"}" {
		t.Fatalf("expected addition result, got %s", response.Body.String())
	}
}

func TestReturnsCanonicalZero(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/add?a=%2B0001&b=-0001", nil)
	response := httptest.NewRecorder()

	newRouter().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if response.Body.String() != "{\"result\":\"0\"}" {
		t.Fatalf("expected canonical zero, got %s", response.Body.String())
	}
}

func TestRejectsValuesThatAreNotASCIIDecimalIntegers(t *testing.T) {
	invalidValues := []string{"", "1.0", "1e3", " 1", "1 ", "١"}
	for _, invalidValue := range invalidValues {
		for _, invalidParameter := range []string{"a", "b"} {
			query := url.Values{"a": {"1"}, "b": {"1"}}
			query.Set(invalidParameter, invalidValue)
			request := httptest.NewRequest(http.MethodGet, "/add?"+query.Encode(), nil)
			response := httptest.NewRecorder()

			newRouter().ServeHTTP(response, request)

			if response.Code != http.StatusBadRequest {
				t.Errorf("expected %s=%q to return %d, got %d", invalidParameter, invalidValue, http.StatusBadRequest, response.Code)
			}
		}
	}
}

func TestRejectsMissingParameters(t *testing.T) {
	for _, query := range []string{"a=1", "b=1"} {
		request := httptest.NewRequest(http.MethodGet, "/add?"+query, nil)
		response := httptest.NewRecorder()

		newRouter().ServeHTTP(response, request)

		if response.Code != http.StatusBadRequest {
			t.Errorf("expected query %q to return %d, got %d", query, http.StatusBadRequest, response.Code)
		}
	}
}

func TestAddsSignedIntegersBeyondMachineRangeAndReturnsCanonicalResult(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/add?a=%2B0009223372036854775808&b=-9223372036854775807", nil)
	response := httptest.NewRecorder()

	newRouter().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if response.Body.String() != "{\"result\":\"1\"}" {
		t.Fatalf("expected canonical exact result beyond machine range, got %s", response.Body.String())
	}
}

func TestRejectsOperandsWithMoreThan1000Digits(t *testing.T) {
	tooLong := "0" + strings.Repeat("9", 1000)
	for _, parameter := range []string{"a", "b"} {
		query := url.Values{"a": {"1"}, "b": {"1"}}
		query.Set(parameter, tooLong)
		request := httptest.NewRequest(http.MethodGet, "/add?"+query.Encode(), nil)
		response := httptest.NewRecorder()

		newRouter().ServeHTTP(response, request)

		if response.Code != http.StatusBadRequest {
			t.Errorf("expected a 1001-digit %s operand to return %d, got %d", parameter, http.StatusBadRequest, response.Code)
		}
	}
}

func TestAdds1000DigitOperandsAndReturns1001DigitResult(t *testing.T) {
	query := url.Values{
		"a": {"+" + strings.Repeat("9", 1000)},
		"b": {strings.Repeat("0", 999) + "1"},
	}
	request := httptest.NewRequest(http.MethodGet, "/add?"+query.Encode(), nil)
	response := httptest.NewRecorder()

	newRouter().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	expectedBody := "{\"result\":\"1" + strings.Repeat("0", 1000) + "\"}"
	if response.Body.String() != expectedBody {
		t.Fatalf("expected exact 1001-digit result, got %s", response.Body.String())
	}
}
