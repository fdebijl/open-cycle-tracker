# Open Cycle Tracker

Open Cycle Tracker is a self-hosted open source period tracking app that keeps your data unreadable to everyone but you, even the server it runs on and the person who runs it.

> [!CAUTION]
> Open Cycle Tracker is currently in an alpha state and should not be installed or used in a production environment.

# Installation
Deploy the Docker Compose file included in this repo to your server of choice.

# Features
Placeholder

# Architecture
Placeholder

# Why does this exist
After Roe v. Wade was overturned in 2022, it became clear that many states in the USA could use data from period-tracking apps to track users and enforce abortion bans/restrictions. Open Cycle Tracker's threat model is squarely aimed at making it impossible for a government, or any other third party, to obtain health information from the users of an OCT instance.

# Glossary of terms

A lot of terms in this codebase and the associated documentation are abbreviated, or not explained every time they're used, in order to keep the relevant sections as small as possible. Refer to the glossary below if you're unsure about any term.

## Health

|Term|Meaning|Note|
|---|---|---|
|CLD|'Cycle-Length-Difference'|Median difference in cycle duration, measured in days|
|Amenorrhea|Absence of a menstrual period|Used by OCT as an indicator of postmenopause|
|STRAW|'Stages of Reproductive Aging Workshop'|A working group that created a relevant staging sytem for female reproductive health in 2001 - see the paper [here](https://www.fertstert.org/article/S0015-0282%2801%2902909-0/fulltext)|
|STRAW+10|'Stages of Reproductive Aging Workshop' + 10 (years)|An update to the STRAW system developed in 2011, which updated the critera based on advances in reproductive research in the ten years since STRAW. OCT uses STRAW+10 stages for menopause predictions|

## Crypto

|Term|Meaning|Note|
|---|---|---|
|DEK|'Data Encryption Key'|The key used to encrypt data before sending it to the server; it never leaves the device unencrypted. There is a single DEK per user, stored on the server as two wrapped copies, one encrypted under the password-derived KEK and one under the recovery-phrase-derived KEK, so a forgotten password can be recovered without re-encrypting any data.|
|KEK|'Key Encryption Key'|The key that encrypts the DEK before storing the DEK on the server - the KEK itself never leaves the device. As with the DEK, each user has two KEKs - one that's derived from the password and one that's derived from the recovery phrase.|
|KDF / 'Deriving key'|'Key Derivation Function'|Key derivation functions have many uses in cryptography, but in the context of OCT we use them to derive the user's KEK and auth hash, where the password or recovery key are the inputs. For this we use argon2id|
|argon2id|A modern key derivation function|Argon2 is a KDF with three variants, which differ in the way they access memory. For OCT the difference is not too relevant, we simply use argon2id for all key derivation. Argon2 won the 2015 Password Hashing Competition and is currently the gold standard for KDF's in web development.|

# LLM Disclaimer
Parts of this codebase were created by a large language model, in particular models provided by Anthropic. Documentation, design, art and architecture is all done by humans.

# License
OCT is licensed under the very permissive MIT license. See [LICENSE](./LICENSE).
