package com.anurag.margin

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Ports src/lib/linkify.test.ts: same inputs, same expected parts. */
class LinkifyTest {
    private fun hrefs(text: String) = Linkify.split(text).filterIsInstance<TextPart.Link>().map { it.href }

    private fun values(text: String) = Linkify.split(text).map { it.value }

    private fun anyText(random: kotlin.random.Random) =
        if (random.nextBoolean()) Gen.hostileText(random, 20) else Gen.binaryString(random, 200)

    @Test
    fun linksOrdinaryHttpsUrlsAndLeavesPunctuationOutsideTheHref() {
        val parts = Linkify.split("Read https://example.com/field-notes?q=1.")
        val link = parts.filterIsInstance<TextPart.Link>().single()
        assertEquals("https://example.com/field-notes?q=1", link.href)
        assertEquals("https://example.com/field-notes?q=1", link.value)
        assertEquals(TextPart.Plain("."), parts.last())
    }

    @Test
    fun keepsXTcoAndTwimgAddressesAsText() {
        val text = listOf(
            "https://x.com/someone/status/1",
            "https://www.twitter.com/someone/status/1",
            "https://t.co/abcXYZ",
            "https://pbs.twimg.com/media/abc.jpg",
            "https://video.twimg.com/ext_tw_video/1.mp4",
        ).joinToString(" ")
        val parts = Linkify.split(text)
        assertEquals(0, parts.count { it is TextPart.Link })
        assertEquals(5, parts.count { it is TextPart.Blocked })
    }

    @Test
    fun doesNotTurnJavascriptCredentialsOddPortsOrMarkupIntoLinks() {
        val text = listOf(
            "javascript:alert(1)",
            "https://user:pass@example.com/secret",
            "https://evil.example:444/phish",
            "<img src=x onerror=alert(1)>",
            "<script>alert(1)</script>",
            "https://example.com/\"onclick=alert(1)",
        ).joinToString("\n")
        val links = hrefs(text)
        assertEquals(listOf("https://example.com/"), links)
        for (href in links) {
            assertTrue(href.startsWith("https://"))
            assertFalse(Regex("javascript:|x\\.com|twitter\\.com|t\\.co|twimg\\.com|onclick|alert", RegexOption.IGNORE_CASE).containsMatchIn(href))
        }
    }

    @Test
    fun stillLinksHostsThatOnlyResembleBlockedNames() {
        assertEquals(
            listOf("https://notx.com/a", "https://example.com/t.co/x"),
            hrefs("https://notx.com/a and https://example.com/t.co/x"),
        )
    }

    @Test
    fun preservesMultilineUnicodeAroundALink() {
        val text = "café 日本語\nhttps://example.com/a\n🌳"
        assertEquals(text, values(text).joinToString(""))
    }

    @Test
    fun neverDropsDuplicatesOrReordersText() {
        Gen.forAll(500, seed = 1, gen = ::anyText) { text ->
            val parts = Linkify.split(text)
            assertEquals(text, parts.joinToString("") { it.value })
            for (part in parts) assertTrue(part.value.isNotEmpty())
        }
    }

    @Test
    fun onlyLinksDefaultPortHttpsUrlsToHostsThatAreNotBlockedWithTheHostAsWritten() {
        Gen.forAll(500, seed = 2, gen = ::anyText) { text ->
            for (part in Linkify.split(text)) {
                if (part is TextPart.Link) {
                    val authority = part.href.substring(8).takeWhile { it !in "/?#" }
                    assertTrue(part.href.substring(0, 8).equals("https://", ignoreCase = true))
                    assertFalse(authority.contains('@') || authority.contains(':'))
                    assertFalse(Urls.isBlockedHost(authority))
                    assertFalse(part.href.any { it.isWhitespace() || it in "\"'<>`" })
                    assertEquals("https://", part.value.take(8).lowercase())
                    assertTrue(part.value.substring(8).lowercase().startsWith(authority.lowercase()))
                }
                if (part is TextPart.Blocked) {
                    assertTrue(Urls.isBlockedHost(part.value.substring(8).takeWhile { it !in "/?#" }))
                }
            }
        }
    }

    @Test
    fun keepsClosingBracketsAndPunctuationOutsideTheLinkUnlessTheyAreBalanced() {
        assertEquals(listOf("https://example.com/a_(b)"), hrefs("(see https://example.com/a_(b))"))
        assertEquals(listOf("https://example.com/x"), hrefs("[https://example.com/x]"))
        assertEquals(listOf("https://example.com/x"), hrefs("https://example.com/x?!."))
        assertEquals(listOf("Go (", "https://example.com/a", ")."), values("Go (https://example.com/a)."))
    }

    @Test
    fun trimsClosingBracketsAndPunctuationInAnyOrderAfterALink() {
        assertEquals(listOf("https://example.com/a"), hrefs("[see (https://example.com/a)]"))
        assertEquals(listOf("https://example.com/a_(b)"), hrefs("(https://example.com/a_(b))]"))
        assertEquals(listOf("https://example.com/a"), hrefs("(see https://example.com/a.)"))
        assertEquals(listOf("https://example.com/a"), hrefs("[https://example.com/a]."))
        assertEquals(listOf("[see (", "https://example.com/a", ")]"), values("[see (https://example.com/a)]"))
    }

    @Test
    fun linksALinkedValueTheSameWayWhenItStandsAlone() {
        Gen.forAll(500, seed = 17, gen = ::anyText) { text ->
            for (part in Linkify.split(text)) {
                if (part is TextPart.Link) assertEquals(listOf(part), Linkify.split(part.value))
            }
        }
    }

    @Test
    fun handlesTensOfThousandsOfClosingBracketsInLinearTime() {
        Linkify.split("https://example.com/))")
        for ((tail, count) in listOf(")" to 11_980, "]" to 11_980, ")" to 40_000, "]" to 40_000)) {
            val text = "https://example.com/${tail.repeat(count)}"
            val started = System.nanoTime()
            val parts = Linkify.split(text)
            val elapsedMs = (System.nanoTime() - started) / 1_000_000
            assertEquals(text, parts.joinToString("") { it.value })
            assertTrue("took $elapsedMs ms", elapsedMs < 100)
        }
    }
}
