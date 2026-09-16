# The whole recipe on one screen: data → batches → model → training → perplexity.
# Same names as above. Runs on 2 000 jokes for one epoch so you can read it top to bottom.

# 1. data: [BOS] tokens [EOS] per joke; a batch is padded,
#    and the target is the input shifted by one
seqs = [torch.tensor([BOS] + e.ids + [EOS]) for e in tok.encode_batch(train[:2_000])]

def batches(seqs, batch_size=64):
    for i in range(0, len(seqs), batch_size):
        chunk = seqs[i:i + batch_size]
        x = pad_sequence([s[:-1] for s in chunk], batch_first=True, padding_value=PAD)
        y = pad_sequence([s[1:] for s in chunk], batch_first=True, padding_value=PAD)
        yield x.to(device), y.to(device)

# 2. model: embedding → LSTM → linear over the vocabulary; state carries h and c between calls
class LM(nn.Module):
    def __init__(self, vocab_size, d=256):
        super().__init__()
        self.emb = nn.Embedding(vocab_size, d, padding_idx=PAD)
        self.rnn = nn.LSTM(d, d, batch_first=True)
        self.out = nn.Linear(d, vocab_size)

    def forward(self, x, state=None):
        h, state = self.rnn(self.emb(x), state)
        return self.out(h), state

# 3. training: cross-entropy at every position except padding, clip the gradient, step
model = LM(V).to(device)
opt = torch.optim.AdamW(model.parameters(), lr=2e-3)
for x, y in batches(seqs):
    logits, _ = model(x)                                             # (B, T, V)
    loss = nn.functional.cross_entropy(logits.reshape(-1, V), y.reshape(-1), ignore_index=PAD)
    opt.zero_grad(); loss.backward()
    nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()

# 4. the number: exp of the mean per-token loss on held-out jokes is the perplexity
with torch.no_grad():
    nll, n = 0.0, 0
    for x, y in batches(test_seqs[:1_000]):
        logits, _ = model(x)
        nll += nn.functional.cross_entropy(logits.reshape(-1, V), y.reshape(-1),
                                           ignore_index=PAD, reduction="sum").item()
        n += (y != PAD).sum().item()
print(f"one epoch on 2 000 jokes: test perplexity {math.exp(nll / n):.1f}")
