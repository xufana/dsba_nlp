## code-rope
```python
pairs = x.reshape(*x.shape[:-1], -1, 2)
angle = position / theta ** (torch.arange(0, d, 2) / d)  # @angle
a, b = pairs.unbind(-1)
rotated = torch.stack((a * angle.cos() - b * angle.sin(),
                       a * angle.sin() + b * angle.cos()), -1)  # @rotation
result = rotated.flatten(-2)
```

## code-ffn
```python
u = up(x)  # @value
g = gate(x)  # @gate
h = u * activation(g)  # @product
output = down(h)  # @down
```

## code-norm
```python
mean = x.mean(dim=-1, keepdim=True)
layer_norm = (x - mean) / ((x - mean).square().mean(-1, keepdim=True) + eps).sqrt()  # @ln
rms_norm = x / (x.square().mean(-1, keepdim=True) + eps).sqrt()  # @rms
```
