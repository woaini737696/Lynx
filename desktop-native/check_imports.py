#!/usr/bin/env python3
"""解析 PE 文件导入表，列出每个 DLL 导入的函数名"""
import struct
import sys

def parse_pe_imports(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()

    # DOS header
    e_lfanew = struct.unpack_from('<I', data, 0x3C)[0]

    # PE signature
    if data[e_lfanew:e_lfanew+4] != b'PE\x00\x00':
        print("Not a valid PE file")
        return

    # COFF header
    coff_offset = e_lfanew + 4
    machine = struct.unpack_from('<H', data, coff_offset)[0]
    num_sections = struct.unpack_from('<H', data, coff_offset + 2)[0]
    opt_header_size = struct.unpack_from('<H', data, coff_offset + 16)[0]

    # Optional header
    opt_offset = coff_offset + 20
    magic = struct.unpack_from('<H', data, opt_offset)[0]
    is_pe32_plus = (magic == 0x20b)

    if is_pe32_plus:
        # PE32+ (64-bit): data directories start at offset 112, import dir is index 1 (offset 120)
        import_dir_rva = struct.unpack_from('<I', data, opt_offset + 120)[0]
    else:
        # PE32 (32-bit): data directories start at offset 96, import dir is index 1 (offset 104)
        import_dir_rva = struct.unpack_from('<I', data, opt_offset + 104)[0]

    # Section headers
    sections_offset = opt_offset + opt_header_size
    sections = []
    for i in range(num_sections):
        s_off = sections_offset + i * 40
        name = data[s_off:s_off+8].rstrip(b'\x00').decode('ascii', errors='replace')
        vsize = struct.unpack_from('<I', data, s_off + 8)[0]
        vaddr = struct.unpack_from('<I', data, s_off + 12)[0]
        raw_size = struct.unpack_from('<I', data, s_off + 16)[0]
        raw_offset = struct.unpack_from('<I', data, s_off + 20)[0]
        sections.append((name, vaddr, vsize, raw_offset, raw_size))

    def rva_to_offset(rva):
        for name, vaddr, vsize, raw_offset, raw_size in sections:
            if vaddr <= rva < vaddr + max(vsize, raw_size):
                return raw_offset + (rva - vaddr)
        return None

    # Parse import directory
    if import_dir_rva == 0:
        print("No import directory")
        return

    import_offset = rva_to_offset(import_dir_rva)
    if import_offset is None:
        print("Cannot resolve import directory RVA")
        return

    print(f"=== Import Table for {filepath} ===\n")

    while True:
        ilt_rva = struct.unpack_from('<I', data, import_offset)[0]  # OriginalFirstThunk
        time_date = struct.unpack_from('<I', data, import_offset + 4)[0]
        forwarder = struct.unpack_from('<I', data, import_offset + 8)[0]
        name_rva = struct.unpack_from('<I', data, import_offset + 12)[0]
        iat_rva = struct.unpack_from('<I', data, import_offset + 16)[0]  # FirstThunk

        if ilt_rva == 0 and name_rva == 0:
            break

        # DLL name
        name_offset = rva_to_offset(name_rva)
        if name_offset:
            dll_name = b''
            i = name_offset
            while data[i] != 0:
                dll_name += bytes([data[i]])
                i += 1
            dll_name = dll_name.decode('ascii', errors='replace')
        else:
            dll_name = "<unknown>"

        print(f"DLL: {dll_name}")

        # Parse ILT (Import Lookup Table)
        thunk_rva = ilt_rva if ilt_rva else iat_rva
        thunk_offset = rva_to_offset(thunk_rva)

        if thunk_offset:
            functions = []
            i = thunk_offset
            while True:
                if is_pe32_plus:
                    entry = struct.unpack_from('<Q', data, i)[0]
                    i += 8
                    if entry == 0:
                        break
                    is_ordinal = (entry & (1 << 63)) != 0
                    if is_ordinal:
                        ordinal = entry & 0xFFFF
                        functions.append(f"  Ordinal #{ordinal}")
                    else:
                        hint_rva = entry & 0x7FFFFFFF
                        hint_offset = rva_to_offset(hint_rva)
                        if hint_offset:
                            hint = struct.unpack_from('<H', data, hint_offset)[0]
                            fname = b''
                            j = hint_offset + 2
                            while data[j] != 0:
                                fname += bytes([data[j]])
                                j += 1
                            functions.append(f"  {fname.decode('ascii', errors='replace')}")
                else:
                    entry = struct.unpack_from('<I', data, i)[0]
                    i += 4
                    if entry == 0:
                        break
                    is_ordinal = (entry & (1 << 31)) != 0
                    if is_ordinal:
                        ordinal = entry & 0xFFFF
                        functions.append(f"  Ordinal #{ordinal}")
                    else:
                        hint_rva = entry & 0x7FFFFFFF
                        hint_offset = rva_to_offset(hint_rva)
                        if hint_offset:
                            hint = struct.unpack_from('<H', data, hint_offset)[0]
                            fname = b''
                            j = hint_offset + 2
                            while data[j] != 0:
                                fname += bytes([data[j]])
                                j += 1
                            functions.append(f"  {fname.decode('ascii', errors='replace')}")

            for f in functions:
                print(f)
        print()
        import_offset += 20

if __name__ == '__main__':
    filepath = sys.argv[1] if len(sys.argv) > 1 else r'D:\LynnHub\cargo-target\release\lynnhub-desktop.exe'
    parse_pe_imports(filepath)
