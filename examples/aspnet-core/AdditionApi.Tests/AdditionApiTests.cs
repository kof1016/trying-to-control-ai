using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AdditionApi.Tests;

public sealed class AdditionApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public AdditionApiTests(WebApplicationFactory<Program> application)
    {
        _client = application.CreateClient();
    }

    [Fact]
    public async Task AddsTwoIntegers()
    {
        using var response = await _client.GetAsync("/add?a=1&b=2");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("{\"result\":\"3\"}", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("%2B0009223372036854775808", "-9223372036854775807", "1")]
    [InlineData("%2B0001", "-0001", "0")]
    public async Task AddsSignedIntegersBeyondMachineRangeAndReturnsCanonicalResult(
        string a,
        string b,
        string expected)
    {
        using var response = await _client.GetAsync($"/add?a={a}&b={b}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal($"{{\"result\":\"{expected}\"}}", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task EnforcesTheOneThousandDigitBoundary()
    {
        var thousandDigitOperand = $"%2B{new string('9', 1_000)}";
        using var acceptedResponse = await _client.GetAsync($"/add?a={thousandDigitOperand}&b=1");

        Assert.Equal(HttpStatusCode.OK, acceptedResponse.StatusCode);
        Assert.Equal(
            $"{{\"result\":\"1{new string('0', 1_000)}\"}}",
            await acceptedResponse.Content.ReadAsStringAsync());

        var overlongOperand = $"-{new string('0', 1_001)}";
        using var overlongAResponse = await _client.GetAsync($"/add?a={overlongOperand}&b=1");
        using var overlongBResponse = await _client.GetAsync($"/add?a=1&b={overlongOperand}");

        Assert.Equal(HttpStatusCode.BadRequest, overlongAResponse.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, overlongBResponse.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("1.0")]
    [InlineData("1e3")]
    [InlineData(" 1")]
    [InlineData("1 ")]
    [InlineData("١")]
    public async Task RejectsValuesThatAreNotAsciiDecimalIntegers(string invalidValue)
    {
        var encodedValue = Uri.EscapeDataString(invalidValue);

        using var invalidAResponse = await _client.GetAsync($"/add?a={encodedValue}&b=1");
        using var invalidBResponse = await _client.GetAsync($"/add?a=1&b={encodedValue}");

        Assert.Equal(HttpStatusCode.BadRequest, invalidAResponse.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, invalidBResponse.StatusCode);
    }

    [Fact]
    public async Task RejectsMissingParameters()
    {
        using var missingAResponse = await _client.GetAsync("/add?b=1");
        using var missingBResponse = await _client.GetAsync("/add?a=1");

        Assert.Equal(HttpStatusCode.BadRequest, missingAResponse.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, missingBResponse.StatusCode);
    }
}
