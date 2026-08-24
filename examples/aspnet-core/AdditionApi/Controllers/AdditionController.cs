using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Numerics;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;

namespace AdditionApi.Controllers;

[ApiController]
[Route("add")]
public sealed partial class AdditionController : ControllerBase
{
    [HttpGet]
    public IActionResult Add([FromQuery] string? a, [FromQuery] string? b)
    {
        if (!IsValidOperand(a) || !IsValidOperand(b))
        {
            return BadRequest();
        }

        var result = BigInteger.Parse(a, CultureInfo.InvariantCulture)
            + BigInteger.Parse(b, CultureInfo.InvariantCulture);

        return Ok(new { result = result.ToString(CultureInfo.InvariantCulture) });
    }

    private static bool IsValidOperand([NotNullWhen(true)] string? value) =>
        value is not null && OperandPattern().IsMatch(value);

    [GeneratedRegex(@"\A[+-]?[0-9]{1,1000}\z", RegexOptions.CultureInvariant)]
    private static partial Regex OperandPattern();
}
