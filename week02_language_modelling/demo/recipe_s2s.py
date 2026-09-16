# Encoder–decoder on one screen:
# pairs → batches → model → teacher-forced training → greedy decoding → BLEU.
# Same names as the notebook. One epoch on 5 000 pairs, so it runs while you read it.

# 1. data: German ids on the source side; [BOS] English [EOS] on the target side
def encode_pairs(de, en):
    return [(torch.tensor(s.ids), torch.tensor([BOS] + t.ids + [EOS]))
            for s, t in zip(tok_de.encode_batch(de), tok_en.encode_batch(en))]

def batches(pairs, batch_size=64):
    for i in range(0, len(pairs), batch_size):
        src, trg = zip(*pairs[i:i + batch_size])
        yield (pad_sequence(src, batch_first=True, padding_value=PAD).to(device),
               torch.tensor([len(s) for s in src]),           # true lengths: packing skips [PAD]
               pad_sequence(trg, batch_first=True, padding_value=PAD).to(device))

pairs, te_pairs = encode_pairs(tr_de[:5_000], tr_en[:5_000]), encode_pairs(te_de, te_en)

# 2. model: bidirectional encoder → one vector → a decoder that is an LM started from it
class Seq2Seq(nn.Module):
    def __init__(self, src_vocab, trg_vocab, d=256):
        super().__init__()
        self.src_emb = nn.Embedding(src_vocab, d, padding_idx=PAD)
        self.trg_emb = nn.Embedding(trg_vocab, d, padding_idx=PAD)
        self.encoder = nn.LSTM(d, d, batch_first=True, bidirectional=True)
        self.h_proj = nn.Linear(2 * d, d)                    # 512 → 256: the bottleneck
        self.c_proj = nn.Linear(2 * d, d)
        self.decoder = nn.LSTM(d, d, batch_first=True)
        self.out = nn.Linear(d, trg_vocab)

    def encode(self, src, src_len):
        packed = pack_padded_sequence(self.src_emb(src), src_len, batch_first=True,
                                      enforce_sorted=False)
        _, (h, c) = self.encoder(packed)                     # (2, B, d): forward and backward
        h, c = torch.cat([h[0], h[1]], -1), torch.cat([c[0], c[1]], -1)
        return torch.tanh(self.h_proj(h))[None], torch.tanh(self.c_proj(c))[None]

    def forward(self, src, src_len, trg_in):                 # training: the gold prefix goes in
        o, _ = self.decoder(self.trg_emb(trg_in), self.encode(src, src_len))
        return self.out(o)

    @torch.no_grad()
    def greedy(self, src, src_len, max_len=40):              # inference: its own output goes in
        state, out = self.encode(src, src_len), []
        y = torch.full((src.size(0), 1), BOS, device=src.device)
        for _ in range(max_len):
            o, state = self.decoder(self.trg_emb(y), state)
            y = self.out(o).argmax(-1)
            out.append(y)
        return torch.cat(out, 1)

# 3. training: the decoder reads trg[:, :-1], is scored against trg[:, 1:] — teacher forcing
model = Seq2Seq(tok_de.get_vocab_size(), tok_en.get_vocab_size()).to(device)
opt = torch.optim.AdamW(model.parameters(), lr=2e-3)
for src, src_len, trg in batches(pairs):
    logits = model(src, src_len, trg[:, :-1])
    loss = nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)),
                                       trg[:, 1:].reshape(-1), ignore_index=PAD)
    opt.zero_grad(); loss.backward()
    nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()

# 4. the number: translate the test set greedily, cut at [EOS], score with sacrebleu
def to_text(row):
    ids = row.tolist()
    return tok_en.decode(ids[:ids.index(EOS)] if EOS in ids else ids)

hyps = [to_text(row) for src, src_len, _ in batches(te_pairs)
        for row in model.greedy(src, src_len)]
print(f"one epoch on 5 000 pairs: test BLEU {sacrebleu.corpus_bleu(hyps, [te_en]).score:.2f}")
