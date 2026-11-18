package com.anurag.margin

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Ports src/lib/urls.test.ts and src/lib/hosts.test.ts. */
class UrlsTest {
    private val canonical = Regex("""^https://(x\.com|twitter\.com)/(?:[A-Za-z0-9_]{1,15}/status|i/web/status)/\d{1,20}$""")
    private val roots = listOf("x.com", "twitter.com", "twimg.com", "t.co")

    private fun label(random: kotlin.random.Random): String {
        val chars = "abcdefghijklmnopqrstuvwxyz0123456789"
        val inner = "$chars-"
        if (random.nextInt(3) == 0) return chars.random(random).toString()
        val middle = (0 until random.nextInt(11)).map { inner.random(random) }.joinToString("")
        return "${chars.random(random)}$middle${chars.random(random)}"
    }

    @Test
    fun canonicalizesStatusUrls() {
        val cases = listOf(
            "https://x.com/ada/status/123" to "https://x.com/ada/status/123",
            "https://www.x.com/ada/status/123/" to "https://x.com/ada/status/123",
            "  https://X.COM/ada/status/123?s=20#frag  " to "https://x.com/ada/status/123",
            "https://mobile.twitter.com/ada/status/123/photo/1" to "https://twitter.com/ada/status/123",
            "https://www.twitter.com/ada/status/123/video/2" to "https://twitter.com/ada/status/123",
            "https://x.com/i/web/status/9" to "https://x.com/i/web/status/9",
        )
        for ((input, expected) in cases) assertEquals(input, expected, Urls.canonicalStatusUrl(input))
    }

    @Test
    fun acceptsTheDefaultPortWrittenOutAsTheWebDoes() {
        for (port in listOf(":443", ":", ":0443")) {
            assertEquals(port, "https://x.com/ada/status/1", Urls.canonicalStatusUrl("https://x.com$port/ada/status/1"))
            assertTrue(port, Urls.isPlainHttps("https://example.com$port/a"))
            assertTrue(port, Linkify.classify("https://example.com$port/a") is TextPart.Plain)
        }
        for (port in listOf(":8443", ":443.", ":44 3", ":-443", ":+443", ":0x1bb")) {
            assertNull(port, Urls.canonicalStatusUrl("https://x.com$port/ada/status/1"))
            assertFalse(port, Urls.isPlainHttps("https://example.com$port/a"))
        }
        assertTrue(SnapshotParser.parse("""{"format":"single-post-snapshot","version":1,"post":{"authorName":"A","authorHandle":"a","text":"t","sourceUrl":"https://x.com:443/a/status/1"}}""") is ParseResult.Ok)
    }

    @Test
    fun rejectsAnythingElseAsAStatusUrl() {
        val inputs = listOf(
            "http://x.com/ada/status/1",
            "https://x.com:8443/ada/status/1",
            "https://user@x.com/ada/status/1",
            "https://user:pw@x.com/ada/status/1",
            "https://evil.example/ada/status/1",
            "https://x.com.evil.example/ada/status/1",
            "https://api.x.com/ada/status/1",
            "https://t.co/abc",
            "https://x.com/ada",
            "https://x.com/ada/status/",
            "https://x.com/ada/status/abc",
            "https://x.com/this_is_too_long_handle/status/1",
            "https://x.com/ada/status/${"1".repeat(21)}",
            "https://x.com\\ada/status/1",
            "https://x.com/ada/\nstatus/1",
            "https://x.com/ada/status/1\u0000",
            "javascript:alert(1)//https://x.com/ada/status/1",
            "x.com/ada/status/1",
            "",
            "https://x.com/ada/status/1?${"a".repeat(600)}",
        )
        for (input in inputs) assertNull(input, Urls.canonicalStatusUrl(input))
    }

    @Test
    fun returnsOnlyCanonicalStatusUrlsAndIsIdempotent() {
        Gen.forAll(1_000, seed = 3, gen = { random ->
            when (random.nextInt(3)) {
                0 -> Gen.webUrl(random)
                1 -> Gen.binaryString(random, 40)
                else -> Gen.HOSTILE.random(random)
            }
        }) { input ->
            val out = Urls.canonicalStatusUrl(input) ?: return@forAll
            assertTrue(out, canonical.matches(out))
            assertEquals(out, Urls.canonicalStatusUrl(out))
        }
    }

    @Test
    fun keepsTheHandleAndTheIdOfAnyStatusUrl() {
        Gen.forAll(500, seed = 4, gen = { random ->
            val host = Gen.pick(random, "x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com")
            val user = (0 until random.nextInt(1, 16)).map { "ABCabc019_".random(random) }.joinToString("")
            val id = (0 until random.nextInt(1, 21)).map { "0123456789".random(random) }.joinToString("")
            val suffix = Gen.pick(random, "", "/", "?s=20", "#x", "/photo/1", "/analytics")
            listOf(host, user, id, suffix)
        }) { (host, user, id, suffix) ->
            val root = if (host.endsWith("twitter.com")) "twitter.com" else "x.com"
            assertEquals("https://$root/$user/status/$id", Urls.canonicalStatusUrl("https://$host/$user/status/$id$suffix"))
        }
    }

    @Test
    fun recognizesBareAddressesWithOrWithoutAScheme() {
        for (text in listOf("https://example.com", "http://example.com/a", "x.com/a/status/1", "  www.twitter.com/a  ", "HTTPS://X.COM")) {
            assertTrue(text, Urls.looksLikeBareUrl(text))
        }
        for (text in listOf("", "hello", "{\"a\":1}", "https://example.com and more", "example.com/a", "https://${"a".repeat(2_000)}")) {
            assertFalse(text.take(40), Urls.looksLikeBareUrl(text))
        }
    }

    @Test
    fun trimsAndSplitsAddressesOnTheWhiteSpaceJavaScriptUses() {
        assertEquals("https://x.com/ada/status/1", Urls.canonicalStatusUrl("\uFEFF\u3000https://x.com/ada/status/1\u2028"))
        assertNull(Urls.canonicalStatusUrl("\u001Fhttps://x.com/ada/status/1"))
        assertTrue(Urls.looksLikeBareUrl("\uFEFFhttps://example.com\u3000"))
        assertFalse(Urls.looksLikeBareUrl("https://example.com/\uFEFFmore"))
        assertTrue(Urls.isXFamilyUrl("\uFEFFx.com/a"))
    }

    @Test
    fun knowsXTwitterAndTcoAddresses() {
        for (text in listOf("https://x.com/a", "x.com/a/status/1", "https://mobile.twitter.com/a", "http://t.co/abc", "https://WWW.X.COM")) {
            assertTrue(text, Urls.isXFamilyUrl(text))
        }
        for (text in listOf("https://example.com", "https://notx.com", "https://x.com.evil.example", "https://", "not a url")) {
            assertFalse(text, Urls.isXFamilyUrl(text))
        }
    }

    @Test
    fun addressChecksNeverThrow() {
        Gen.forAll(1_000, seed = 5, gen = { Gen.binaryString(it, 100) }) { text ->
            Urls.isXFamilyUrl(text)
            Urls.looksLikeBareUrl(text)
            Urls.canonicalStatusUrl(text)
            Urls.isPlainHttps(text)
        }
    }

    @Test
    fun blocksTheRootsAndTheirSubdomainsInAnyCaseWithATrailingDotOrBrackets() {
        for (host in listOf("x.com", "X.COM", "x.com.", " www.x.com ", "mobile.twitter.com", "pbs.twimg.com", "video.twimg.com", "t.co", "T.Co.", "[x.com]")) {
            assertTrue(host, Urls.isBlockedHost(host))
        }
        for (host in listOf("", " ", "notx.com", "x.com.evil.example", "xcom", "twitter.co", "t.com", "tco", "example.com")) {
            assertFalse(host, Urls.isBlockedHost(host))
        }
    }

    @Test
    fun blocksEverySubdomainOfARoot() {
        Gen.forAll(500, seed = 6, gen = { random ->
            (0 until random.nextInt(1, 5)).joinToString(".") { label(random) } + "." + roots.random(random)
        }) { host -> assertTrue(Urls.isBlockedHost(host)) }
    }

    @Test
    fun doesNotBlockAHostThatOnlyContainsARootAsAPrefixOrInfix() {
        Gen.forAll(500, seed = 7, gen = { random ->
            Triple(label(random), roots.random(random), Gen.pick(random, "example", "evil.test"))
        }) { (prefix, root, tld) ->
            assertFalse(Urls.isBlockedHost("$root.$prefix.$tld"))
            assertFalse(Urls.isBlockedHost("$prefix$root"))
        }
    }
}
