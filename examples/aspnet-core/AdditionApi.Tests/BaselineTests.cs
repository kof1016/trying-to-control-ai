using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AdditionApi.Tests;

public sealed class BaselineTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _application;

    public BaselineTests(WebApplicationFactory<Program> application)
    {
        _application = application;
    }

    [Fact]
    public async Task ApplicationStarts()
    {
        using var client = _application.CreateClient();

        using var response = await client.GetAsync("/");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
