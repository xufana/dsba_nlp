## code-cache
```python
q = q_proj(x_new)
k_new, v_new = k_proj(x_new), v_proj(x_new)  # @new
k = torch.cat((k_cache, k_new), dim=-2)  # @keys
v = torch.cat((v_cache, v_new), dim=-2)  # @values
output = (q @ k.transpose(-2, -1) / math.sqrt(d)).softmax(-1) @ v  # @read
```

## code-gqa
```python
group_size = query_heads // kv_heads
kv_head = query_head // group_size  # @group
keys, values = k[kv_head], v[kv_head]  # @shared
```
