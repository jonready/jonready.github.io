
/*original bsdiff file for reference:
#include "bsdiff.h"

#include <limits.h>
#include <string.h>

#define MIN(x,y) (((x)<(y)) ? (x) : (y))

static void split(int64_t *I,int64_t *V,int64_t start,int64_t len,int64_t h)
{
	int64_t i,j,k,x,tmp,jj,kk;

	if(len<16) {
		for(k=start;k<start+len;k+=j) {
			j=1;x=V[I[k]+h];
			for(i=1;k+i<start+len;i++) {
				if(V[I[k+i]+h]<x) {
					x=V[I[k+i]+h];
					j=0;
				};
				if(V[I[k+i]+h]==x) {
					tmp=I[k+j];I[k+j]=I[k+i];I[k+i]=tmp;
					j++;
				};
			};
			for(i=0;i<j;i++) V[I[k+i]]=k+j-1;
			if(j==1) I[k]=-1;
		};
		return;
	};

	x=V[I[start+len/2]+h];
	jj=0;kk=0;
	for(i=start;i<start+len;i++) {
		if(V[I[i]+h]<x) jj++;
		if(V[I[i]+h]==x) kk++;
	};
	jj+=start;kk+=jj;

	i=start;j=0;k=0;
	while(i<jj) {
		if(V[I[i]+h]<x) {
			i++;
		} else if(V[I[i]+h]==x) {
			tmp=I[i];I[i]=I[jj+j];I[jj+j]=tmp;
			j++;
		} else {
			tmp=I[i];I[i]=I[kk+k];I[kk+k]=tmp;
			k++;
		};
	};

	while(jj+j<kk) {
		if(V[I[jj+j]+h]==x) {
			j++;
		} else {
			tmp=I[jj+j];I[jj+j]=I[kk+k];I[kk+k]=tmp;
			k++;
		};
	};

	if(jj>start) split(I,V,start,jj-start,h);

	for(i=0;i<kk-jj;i++) V[I[jj+i]]=kk-1;
	if(jj==kk-1) I[jj]=-1;

	if(start+len>kk) split(I,V,kk,start+len-kk,h);
}

static void qsufsort(int64_t *I,int64_t *V,const uint8_t *old,int64_t oldsize)
{
	int64_t buckets[256];
	int64_t i,h,len;

	for(i=0;i<256;i++) buckets[i]=0;
	for(i=0;i<oldsize;i++) buckets[old[i]]++;
	for(i=1;i<256;i++) buckets[i]+=buckets[i-1];
	for(i=255;i>0;i--) buckets[i]=buckets[i-1];
	buckets[0]=0;

	for(i=0;i<oldsize;i++) I[++buckets[old[i]]]=i;
	I[0]=oldsize;
	for(i=0;i<oldsize;i++) V[i]=buckets[old[i]];
	V[oldsize]=0;
	for(i=1;i<256;i++) if(buckets[i]==buckets[i-1]+1) I[buckets[i]]=-1;
	I[0]=-1;

	for(h=1;I[0]!=-(oldsize+1);h+=h) {
		len=0;
		for(i=0;i<oldsize+1;) {
			if(I[i]<0) {
				len-=I[i];
				i-=I[i];
			} else {
				if(len) I[i-len]=-len;
				len=V[I[i]]+1-i;
				split(I,V,i,len,h);
				i+=len;
				len=0;
			};
		};
		if(len) I[i-len]=-len;
	};

	for(i=0;i<oldsize+1;i++) I[V[i]]=i;
}

static int64_t matchlen(const uint8_t *old,int64_t oldsize,const uint8_t *new,int64_t newsize)
{
	int64_t i;

	for(i=0;(i<oldsize)&&(i<newsize);i++)
		if(old[i]!=new[i]) break;

	return i;
}

static int64_t search(const int64_t *I,const uint8_t *old,int64_t oldsize,
		const uint8_t *new,int64_t newsize,int64_t st,int64_t en,int64_t *pos)
{
	int64_t x,y;

	if(en-st<2) {
		x=matchlen(old+I[st],oldsize-I[st],new,newsize);
		y=matchlen(old+I[en],oldsize-I[en],new,newsize);

		if(x>y) {
			*pos=I[st];
			return x;
		} else {
			*pos=I[en];
			return y;
		}
	};

	x=st+(en-st)/2;
	if(memcmp(old+I[x],new,MIN(oldsize-I[x],newsize))<0) {
		return search(I,old,oldsize,new,newsize,x,en,pos);
	} else {
		return search(I,old,oldsize,new,newsize,st,x,pos);
	};
}

static void offtout(int64_t x,uint8_t *buf)
{
	int64_t y;

	if(x<0) y=-x; else y=x;

	buf[0]=y%256;y-=buf[0];
	y=y/256;buf[1]=y%256;y-=buf[1];
	y=y/256;buf[2]=y%256;y-=buf[2];
	y=y/256;buf[3]=y%256;y-=buf[3];
	y=y/256;buf[4]=y%256;y-=buf[4];
	y=y/256;buf[5]=y%256;y-=buf[5];
	y=y/256;buf[6]=y%256;y-=buf[6];
	y=y/256;buf[7]=y%256;

	if(x<0) buf[7]|=0x80;
}

static int64_t writedata(struct bsdiff_stream* stream, const void* buffer, int64_t length)
{
	int64_t result = 0;

	while (length > 0)
	{
		const int smallsize = (int)MIN(length, INT_MAX);
		const int writeresult = stream->write(stream, buffer, smallsize);
		if (writeresult == -1)
		{
			return -1;
		}

		result += writeresult;
		length -= smallsize;
		buffer = (uint8_t*)buffer + smallsize;
	}

	return result;
}

struct bsdiff_request
{
	const uint8_t* old;
	int64_t oldsize;
	const uint8_t* new;
	int64_t newsize;
	struct bsdiff_stream* stream;
	int64_t *I;
	uint8_t *buffer;
};

static int bsdiff_internal(const struct bsdiff_request req)
{
	int64_t *I,*V;
	int64_t scan,pos,len;
	int64_t lastscan,lastpos,lastoffset;
	int64_t oldscore,scsc;
	int64_t s,Sf,lenf,Sb,lenb;
	int64_t overlap,Ss,lens;
	int64_t i;
	uint8_t *buffer;
	uint8_t buf[8 * 3];

	if((V=req.stream->malloc((req.oldsize+1)*sizeof(int64_t)))==NULL) return -1;
	I = req.I;

	qsufsort(I,V,req.old,req.oldsize);
	req.stream->free(V);

	buffer = req.buffer;

	//Compute the differences, writing ctrl as we go
	scan=0;len=0;pos=0;
	lastscan=0;lastpos=0;lastoffset=0;
	while(scan<req.newsize) {
		oldscore=0;

		for(scsc=scan+=len;scan<req.newsize;scan++) {
			len=search(I,req.old,req.oldsize,req.new+scan,req.newsize-scan,
					0,req.oldsize,&pos);

			for(;scsc<scan+len;scsc++)
			if((scsc+lastoffset<req.oldsize) &&
				(req.old[scsc+lastoffset] == req.new[scsc]))
				oldscore++;

			if(((len==oldscore) && (len!=0)) || 
				(len>oldscore+8)) break;

			if((scan+lastoffset<req.oldsize) &&
				(req.old[scan+lastoffset] == req.new[scan]))
				oldscore--;
		};

		if((len!=oldscore) || (scan==req.newsize)) {
			s=0;Sf=0;lenf=0;
			for(i=0;(lastscan+i<scan)&&(lastpos+i<req.oldsize);) {
				if(req.old[lastpos+i]==req.new[lastscan+i]) s++;
				i++;
				if(s*2-i>Sf*2-lenf) { Sf=s; lenf=i; };
			};

			lenb=0;
			if(scan<req.newsize) {
				s=0;Sb=0;
				for(i=1;(scan>=lastscan+i)&&(pos>=i);i++) {
					if(req.old[pos-i]==req.new[scan-i]) s++;
					if(s*2-i>Sb*2-lenb) { Sb=s; lenb=i; };
				};
			};

			if(lastscan+lenf>scan-lenb) {
				overlap=(lastscan+lenf)-(scan-lenb);
				s=0;Ss=0;lens=0;
				for(i=0;i<overlap;i++) {
					if(req.new[lastscan+lenf-overlap+i]==
					   req.old[lastpos+lenf-overlap+i]) s++;
					if(req.new[scan-lenb+i]==
					   req.old[pos-lenb+i]) s--;
					if(s>Ss) { Ss=s; lens=i+1; };
				};

				lenf+=lens-overlap;
				lenb-=lens;
			};

			offtout(lenf,buf);
			offtout((scan-lenb)-(lastscan+lenf),buf+8);
			offtout((pos-lenb)-(lastpos+lenf),buf+16);

			//Write control data
			if (writedata(req.stream, buf, sizeof(buf)))
				return -1;

			// Write diff data 
			for(i=0;i<lenf;i++)
				buffer[i]=req.new[lastscan+i]-req.old[lastpos+i];
			if (writedata(req.stream, buffer, lenf))
				return -1;

			// Write extra data
			for(i=0;i<(scan-lenb)-(lastscan+lenf);i++)
				buffer[i]=req.new[lastscan+lenf+i];
			if (writedata(req.stream, buffer, (scan-lenb)-(lastscan+lenf)))
				return -1;

			lastscan=scan-lenb;
			lastpos=pos-lenb;
			lastoffset=pos-scan;
		};
	};

	return 0;
}

int bsdiff(const uint8_t* old, int64_t oldsize, const uint8_t* new, int64_t newsize, struct bsdiff_stream* stream)
{
	int result;
	struct bsdiff_request req;

	if((req.I=stream->malloc((oldsize+1)*sizeof(int64_t)))==NULL)
		return -1;

	if((req.buffer=stream->malloc(newsize+1))==NULL)
	{
		stream->free(req.I);
		return -1;
	}

	req.old = old;
	req.oldsize = oldsize;
	req.new = new;
	req.newsize = newsize;
	req.stream = stream;

	result = bsdiff_internal(req);

	stream->free(req.buffer);
	stream->free(req.I);

	return result;
}

#if defined(BSDIFF_EXECUTABLE)

#include <sys/types.h>

#include <bzlib.h>
#include <err.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

static int bz2_write(struct bsdiff_stream* stream, const void* buffer, int size)
{
	int bz2err;
	BZFILE* bz2;

	bz2 = (BZFILE*)stream->opaque;
	BZ2_bzWrite(&bz2err, bz2, (void*)buffer, size);
	if (bz2err != BZ_STREAM_END && bz2err != BZ_OK)
		return -1;

	return 0;
}

int main(int argc,char *argv[])
{
	int fd;
	int bz2err;
	uint8_t *old,*new;
	off_t oldsize,newsize;
	uint8_t buf[8];
	FILE * pf;
	struct bsdiff_stream stream;
	BZFILE* bz2;

	memset(&bz2, 0, sizeof(bz2));
	stream.malloc = malloc;
	stream.free = free;
	stream.write = bz2_write;

	if(argc!=4) errx(1,"usage: %s oldfile newfile patchfile\n",argv[0]);

	// Allocate oldsize+1 bytes instead of oldsize bytes to ensure that we never try to malloc(0) and get a NULL pointer
	if(((fd=open(argv[1],O_RDONLY,0))<0) ||
		((oldsize=lseek(fd,0,SEEK_END))==-1) ||
		((old=malloc(oldsize+1))==NULL) ||
		(lseek(fd,0,SEEK_SET)!=0) ||
		(read(fd,old,oldsize)!=oldsize) ||
		(close(fd)==-1)) err(1,"%s",argv[1]);


	// Allocate newsize+1 bytes instead of newsize bytes to ensure that we never try to malloc(0) and get a NULL pointer 
	if(((fd=open(argv[2],O_RDONLY,0))<0) ||
		((newsize=lseek(fd,0,SEEK_END))==-1) ||
		((new=malloc(newsize+1))==NULL) ||
		(lseek(fd,0,SEEK_SET)!=0) ||
		(read(fd,new,newsize)!=newsize) ||
		(close(fd)==-1)) err(1,"%s",argv[2]);

	//Create the patch file
	if ((pf = fopen(argv[3], "w")) == NULL)
		err(1, "%s", argv[3]);

	// Write header (signature+newsize)
	offtout(newsize, buf);
	if (fwrite("ENDSLEY/BSDIFF43", 16, 1, pf) != 1 ||
		fwrite(buf, sizeof(buf), 1, pf) != 1)
		err(1, "Failed to write header");


	if (NULL == (bz2 = BZ2_bzWriteOpen(&bz2err, pf, 9, 0, 0)))
		errx(1, "BZ2_bzWriteOpen, bz2err=%d", bz2err);

	stream.opaque = bz2;
	if (bsdiff(old, oldsize, new, newsize, &stream))
		err(1, "bsdiff");

	BZ2_bzWriteClose(&bz2err, bz2, 0, NULL, NULL);
	if (bz2err != BZ_OK)
		err(1, "BZ2_bzWriteClose, bz2err=%d", bz2err);

	if (fclose(pf))
		err(1, "fclose");

	// Free the memory we used
	free(old);
	free(new);

	return 0;
}

#endif
*/

// Bsdiff implementation in JavaScript
class BsDiff {
  constructor(oldData, newData) {
    this.oldData = oldData;
    this.newData = newData;
    this.oldSize = oldData.length;
    this.newSize = newData.length;
  }

  // Build suffix array using efficient O(n log^2 n) algorithm
  buildSuffixArray() {
    console.time('Build suffix array');
    const n = this.oldSize;
    const suffixes = [];

    // Initialize suffixes with rank based on first character
    for (let i = 0; i < n; i++) {
      suffixes.push({
        index: i,
        rank: this.oldData[i],
        next: (i + 1 < n ? this.oldData[i + 1] : -1)
      });
    }

    // Sort by first 2 characters
    suffixes.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.next - b.next;
    });

    // Build suffix array by doubling the prefix length
    const ind = new Array(n);

    for (let length = 4; length < 2 * n; length <<= 1) {
      // Assign new ranks
      let rank = 0;
      let prev = suffixes[0].rank;
      suffixes[0].rank = rank;
      ind[suffixes[0].index] = 0;

      for (let i = 1; i < n; i++) {
        if (suffixes[i].rank === prev && suffixes[i].next === suffixes[i - 1].next) {
          prev = suffixes[i].rank;
          suffixes[i].rank = rank;
        } else {
          prev = suffixes[i].rank;
          suffixes[i].rank = ++rank;
        }
        ind[suffixes[i].index] = i;
      }

      // Update next ranks
      for (let i = 0; i < n; i++) {
        const nextP = suffixes[i].index + length / 2;
        suffixes[i].next = nextP < n ? suffixes[ind[nextP]].rank : -1;
      }

      // Sort by current prefix
      suffixes.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.next - b.next;
      });
    }

    // Extract just the indices
    const result = suffixes.map(s => s.index);

    console.timeEnd('Build suffix array');
    return result;
  }

  // Find length of matching prefix
  matchlen(oldPos, newPos) {
    let i = 0;
    while (oldPos + i < this.oldSize && newPos + i < this.newSize) {
      if (this.oldData[oldPos + i] !== this.newData[newPos + i]) {
        break;
      }
      i++;
    }
    return i;
  }

  // Binary search for best match in old data
  search(suffixArray, newPos, newLen) {
    let start = 0;
    let end = this.oldSize;
    let bestPos = 0;
    let bestLen = 0;

    while (end - start > 1) {
      const mid = start + Math.floor((end - start) / 2);
      const oldPos = suffixArray[mid];

      let cmp = 0;
      const maxLen = Math.min(this.oldSize - oldPos, newLen);
      for (let i = 0; i < maxLen; i++) {
        cmp = this.newData[newPos + i] - this.oldData[oldPos + i];
        if (cmp !== 0) break;
      }

      if (cmp < 0) {
        end = mid;
      } else {
        start = mid;
      }
    }

    // Check both boundaries
    for (const idx of [start, end]) {
      if (idx < this.oldSize) {
        const len = this.matchlen(suffixArray[idx], newPos);
        if (len > bestLen) {
          bestLen = len;
          bestPos = suffixArray[idx];
        }
      }
    }

    return { pos: bestPos, len: bestLen };
  }

  // Main bsdiff algorithm
  diff() {
    const suffixArray = this.buildSuffixArray();
    const sections = [];

    let scan = 0;
    let lastScan = 0;
    let lastPos = 0;
    let lastOffset = 0;
    let len = 0;  // Must persist across while iterations for scan += len
    let searchCalls = 0;

    console.time('Main diff loop');
    while (scan < this.newSize) {
      let oldScore = 0;
      let pos = 0;

      // Skip ahead by previous match length (key optimization from C code)
      scan += len;
      
      // Find best match for current position
      for (let scsc = scan; scan < this.newSize; scan++) {
        searchCalls++;
        const match = this.search(suffixArray, scan, this.newSize - scan);
        len = match.len;
        pos = match.pos;

        // Score the match based on how many bytes match at lastOffset
        for (; scsc < scan + len; scsc++) {
          if (scsc + lastOffset < this.oldSize &&
              this.oldData[scsc + lastOffset] === this.newData[scsc]) {
            oldScore++;
          }
        }

        // Good enough match found
        if ((len === oldScore && len !== 0) || len > oldScore + 8) {
          break;
        }

        // Update score
        if (scan + lastOffset < this.oldSize &&
            this.oldData[scan + lastOffset] === this.newData[scan]) {
          oldScore--;
        }
      }

      // Process the section from lastScan to scan
      if (len !== oldScore || scan === this.newSize) {
        // Find forward match length
        // Note: C version increments i BEFORE the condition check, so we use i+1 here
        let s = 0, Sf = 0, lenf = 0;
        for (let i = 0; lastScan + i < scan && lastPos + i < this.oldSize; i++) {
          if (this.oldData[lastPos + i] === this.newData[lastScan + i]) {
            s++;
          }
          if (s * 2 - (i + 1) > Sf * 2 - lenf) {
            Sf = s;
            lenf = i + 1;
          }
        }

        // Find backward match length
        let Sb = 0, lenb = 0;
        if (scan < this.newSize) {
          s = 0;
          for (let i = 1; scan >= lastScan + i && pos >= i; i++) {
            if (this.oldData[pos - i] === this.newData[scan - i]) {
              s++;
            }
            if (s * 2 - i > Sb * 2 - lenb) {
              Sb = s;
              lenb = i;
            }
          }
        }

        // Handle overlap
        if (lastScan + lenf > scan - lenb) {
          const overlap = (lastScan + lenf) - (scan - lenb);
          s = 0;
          let Ss = 0, lens = 0;
          for (let i = 0; i < overlap; i++) {
            if (this.newData[lastScan + lenf - overlap + i] ===
                this.oldData[lastPos + lenf - overlap + i]) {
              s++;
            }
            if (this.newData[scan - lenb + i] ===
                this.oldData[pos - lenb + i]) {
              s--;
            }
            if (s > Ss) {
              Ss = s;
              lens = i + 1;
            }
          }
          lenf += lens - overlap;
          lenb -= lens;
        }

        // Create DIFF section
        if (lenf > 0) {
          const diffData = [];
          for (let i = 0; i < lenf; i++) {
            diffData.push(this.newData[lastScan + i] - this.oldData[lastPos + i]);
          }
          sections.push({
            type: 'DIFF',
            length: lenf,
            oldPos: lastPos,
            newPos: lastScan,
            data: diffData
          });
        }

        // Create EXTRA section
        const extraLen = (scan - lenb) - (lastScan + lenf);
        if (extraLen > 0) {
          const extraData = [];
          for (let i = 0; i < extraLen; i++) {
            extraData.push(this.newData[lastScan + lenf + i]);
          }
          sections.push({
            type: 'EXTRA',
            length: extraLen,
            newPos: lastScan + lenf,
            data: extraData
          });
        }

        lastScan = scan - lenb;
        lastPos = pos - lenb;
        lastOffset = pos - scan;
      }
    }

    console.timeEnd('Main diff loop');
    console.log('Search calls:', searchCalls);
    return sections;
  }
}

function toggleExpand(sectionId, moreCount) {
  const preview = document.getElementById(`${sectionId}-preview`);
  const full = document.getElementById(`${sectionId}-full`);
  const toggle = document.getElementById(`${sectionId}-toggle`);
  
  if (full.style.display === 'none') {
    // Expand
    preview.style.display = 'none';
    full.style.display = 'inline';
    toggle.textContent = ' (collapse)';
  } else {
    // Collapse
    preview.style.display = 'inline';
    full.style.display = 'none';
    toggle.textContent = ` ... (${moreCount} more)`;
  }
}

function runBsdiff() {
  const oldText = document.getElementById('oldText').value;
  const newText = document.getElementById('newText').value;

  console.time('Total bsdiff');

  // Convert strings to byte arrays
  console.time('Convert to bytes');
  const oldData = Array.from(oldText).map(c => c.charCodeAt(0));
  const newData = Array.from(newText).map(c => c.charCodeAt(0));
  console.timeEnd('Convert to bytes');

  const bsdiff = new BsDiff(oldData, newData);

  console.time('Diff algorithm');
  const sections = bsdiff.diff();
  console.timeEnd('Diff algorithm');

  console.time('Display results');
  displayResults(oldText, newText, sections);
  console.timeEnd('Display results');

  console.timeEnd('Total bsdiff');
}

function displayResults(oldText, newText, sections) {
  const resultsDiv = document.getElementById('results');

  // Calculate statistics
  // All DIFF section bytes are stored as (new[i] - old[i])
  // - When diff = 0, bytes are identical (compresses to almost nothing)
  // - When diff ≠ 0, bytes differ (patterns still compress well)
  // EXTRA section bytes are stored as raw values (no old file correspondence)
  let diffZeroBytes = 0, diffNonZeroBytes = 0, extraBytes = 0;
  sections.forEach(s => {
    if (s.type === 'DIFF') {
      s.data.forEach(d => {
        if (d === 0) diffZeroBytes++;
        else diffNonZeroBytes++;
      });
    }
    if (s.type === 'EXTRA') extraBytes += s.length;
  });

  let html = `
    <div style="background: white; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
      <div style="font-weight: 600; margin-bottom: 16px; color: #2c3e50;">Patch Statistics:</div>
      <div style="font-size: 13px; color: #666; margin-bottom: 16px;">
        bsdiff stores DIFF sections as byte differences: <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">new[i] - old[i]</code>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
        <div style="background: #e8f5e9; padding: 12px; border-radius: 4px; border-left: 3px solid #4caf50;">
          <div style="font-size: 24px; font-weight: 600; color: #2e7d32;">${diffZeroBytes}</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">DIFF (Δ=0)</div>
          <div style="font-size: 11px; color: #999; margin-top: 2px;">Stored as 0, compresses to ~nothing</div>
        </div>
        <div style="background: #e3f2fd; padding: 12px; border-radius: 4px; border-left: 3px solid #2196f3;">
          <div style="font-size: 24px; font-weight: 600; color: #1976d2;">${diffNonZeroBytes}</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">DIFF (Δ≠0)</div>
          <div style="font-size: 11px; color: #999; margin-top: 2px;">Stored as difference value</div>
        </div>
        <div style="background: #f3e5f5; padding: 12px; border-radius: 4px; border-left: 3px solid #9c27b0;">
          <div style="font-size: 24px; font-weight: 600; color: #7b1fa2;">${extraBytes}</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">EXTRA</div>
          <div style="font-size: 11px; color: #999; margin-top: 2px;">Raw bytes, no old correspondence</div>
        </div>
      </div>
    </div>

    <div style="background: white; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
      <div style="font-weight: 600; margin-bottom: 12px; color: #2c3e50;">Patch Sections:</div>
      <div style="font-size: 13px; color: #666; margin-bottom: 16px;">
        The patch is broken into ${sections.length} section(s):
      </div>
  `;

  sections.forEach((section, idx) => {
    const colors = {
      'DIFF': { bg: '#e3f2fd', border: '#2196f3', text: '#1976d2' },
      'EXTRA': { bg: '#f3e5f5', border: '#9c27b0', text: '#7b1fa2' },
      'COPY': { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' }
    };
    const color = colors[section.type];

    html += `
      <div style="background: ${color.bg}; padding: 12px; border-radius: 4px; border-left: 3px solid ${color.border}; margin-bottom: 8px; font-size: 13px;">
        <div style="font-weight: 600; color: ${color.text}; margin-bottom: 6px;">
          ${section.type} (${section.length} bytes)
        </div>
    `;

    if (section.type === 'DIFF') {
      const maxShow = 100;
      const needsExpand = section.data.length > maxShow;
      const preview = section.data.slice(0, maxShow).map(d =>
        d === 0 ? '<span style="color: #4caf50;">0</span>' :
        `<span style="color: ${color.text}; font-weight: 600;">${d >= 0 ? '+' : ''}${d}</span>`
      ).join(' ');
      const fullContent = section.data.map(d =>
        d === 0 ? '<span style="color: #4caf50;">0</span>' :
        `<span style="color: ${color.text}; font-weight: 600;">${d >= 0 ? '+' : ''}${d}</span>`
      ).join(' ');
      const sectionId = `diff-${idx}`;
      html += `
        <div style="font-family: 'SF Mono', Monaco, monospace; font-size: 11px; color: #666;">
          Position: old[${section.oldPos}] → new[${section.newPos}]
        </div>
        <div style="font-family: 'SF Mono', Monaco, monospace; font-size: 11px; margin-top: 6px; word-wrap: break-word;">
          Diff: <span id="${sectionId}-preview">${preview}</span><span id="${sectionId}-full" style="display: none;">${fullContent}</span>${needsExpand ? `<span id="${sectionId}-toggle" onclick="toggleExpand('${sectionId}', ${section.data.length - maxShow})" style="color: #1976d2; cursor: pointer; text-decoration: underline;"> ... (${section.data.length - maxShow} more)</span>` : ''}
        </div>
      `;
    } else if (section.type === 'EXTRA') {
      const maxShow = 120;
      const needsExpand = section.data.length > maxShow;
      const text = String.fromCharCode(...section.data.slice(0, maxShow));
      const fullText = String.fromCharCode(...section.data);
      const sectionId = `extra-${idx}`;
      html += `
        <div style="font-family: 'SF Mono', Monaco, monospace; font-size: 11px; color: #666;">
          Position: new[${section.newPos}]
        </div>
        <div style="font-family: 'SF Mono', Monaco, monospace; font-size: 11px; margin-top: 6px; word-wrap: break-word;">
          Data: "<span id="${sectionId}-preview">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '↵')}</span><span id="${sectionId}-full" style="display: none;">${fullText.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '↵')}</span>"${needsExpand ? `<span id="${sectionId}-toggle" onclick="toggleExpand('${sectionId}', ${section.data.length - maxShow})" style="color: #7b1fa2; cursor: pointer; text-decoration: underline;"> ... (${section.data.length - maxShow} more)</span>` : ''}
        </div>
      `;
    }

    html += `</div>`;
  });

  html += `</div>`;

  // Visualization of the new file
  html += `
    <div style="background: white; padding: 20px; border-radius: 6px;">
      <div style="font-weight: 600; margin-bottom: 12px; color: #2c3e50;">New File Visualization:</div>
      <div style="font-size: 13px; color: #666; margin-bottom: 12px;">
        Each byte colored by how it's encoded in the patch:
      </div>
      <div style="font-family: 'SF Mono', Monaco, monospace; font-size: 14px; line-height: 2; background: #f9f9f9; padding: 16px; border-radius: 4px; word-break: break-all;">
  `;

  // Build character-by-character visualization
  let newPos = 0;
  sections.forEach(section => {
    if (section.type === 'DIFF') {
      for (let i = 0; i < section.length; i++) {
        const char = newText[newPos++];
        const diffVal = section.data[i];
        const isZero = diffVal === 0;
        const bg = isZero ? '#4caf50' : '#2196f3';
        const title = isZero ? 'DIFF: Δ=0 (identical byte)' : `DIFF: Δ=${diffVal >= 0 ? '+' : ''}${diffVal}`;
        html += `<span style="background: ${bg}; color: white; padding: 2px 4px; border-radius: 2px; margin: 0 1px;" title="${title}">${char.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;')}</span>`;
      }
    } else if (section.type === 'EXTRA') {
      for (let i = 0; i < section.length; i++) {
        const char = newText[newPos++];
        html += `<span style="background: #9c27b0; color: white; padding: 2px 4px; border-radius: 2px; margin: 0 1px;" title="EXTRA: raw byte (no old correspondence)">${char.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;')}</span>`;
      }
    }
  });

  html += `
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; font-size: 12px;">
        <div><span style="display: inline-block; width: 12px; height: 12px; background: #4caf50; border-radius: 2px; margin-right: 6px;"></span>DIFF (Δ=0) — stored as 0</div>
        <div><span style="display: inline-block; width: 12px; height: 12px; background: #2196f3; border-radius: 2px; margin-right: 6px;"></span>DIFF (Δ≠0) — stored as difference</div>
        <div><span style="display: inline-block; width: 12px; height: 12px; background: #9c27b0; border-radius: 2px; margin-right: 6px;"></span>EXTRA — stored as raw byte</div>
      </div>
    </div>
  `;

  resultsDiv.innerHTML = html;
}

function loadExample(type) {
  const examples = {
    text: {
      old: `The quick brown fox jumps over the lazy dog.
She sells seashells by the seashore.
Peter Piper picked a peck of pickled peppers.
How much wood would a woodchuck chuck?`,
      new: `The quick brown fox leaps over the lazy dog and cat.
She sells seashells by the seashore daily.
Peter Piper picked a peck of pickled peppers yesterday.
How much wood would a woodchuck chuck if a woodchuck could chuck wood?`
    },
    assembly: {
      old: `0000000000001000 <main>:
    1000: push   %rbp
    1001: mov    %rsp,%rbp
    1004: sub    $0x20,%rsp
    1008: mov    %edi,-0x14(%rbp)
    100b: mov    %esi,-0x18(%rbp)
    100e: callq  1030 <check_input>
    1013: test   %eax,%eax
    1015: je     1025 <error_exit>
    1017: mov    -0x14(%rbp),%edi
    101a: callq  1030 <check_input>
    101f: mov    %eax,-0x4(%rbp)
    1022: jmp    102a <success>
    1025: mov    $0xffffffff,%eax
    102a: leave
    102b: retq

0000000000001030 <check_input>:
    1030: push   %rbp
    1031: mov    %rsp,%rbp
    1034: cmp    $0x0,%edi
    1037: setg   %al
    103a: pop    %rbp
    103b: retq`,
      new: `0000000000001000 <main>:
    1000: push   %rbp
    1001: mov    %rsp,%rbp
    1004: sub    $0x20,%rsp
    1008: mov    %edi,-0x14(%rbp)
    100b: mov    %esi,-0x18(%rbp)
    100e: test   %edi,%edi
    1010: callq  1032 <check_input>
    1015: test   %eax,%eax
    1017: je     1027 <error_exit>
    1019: mov    -0x14(%rbp),%edi
    101c: callq  1032 <check_input>
    1021: mov    %eax,-0x4(%rbp)
    1024: jmp    102c <success>
    1027: mov    $0xffffffff,%eax
    102c: leave
    102d: retq

0000000000001032 <check_input>:
    1032: push   %rbp
    1033: mov    %rsp,%rbp
    1036: cmp    $0x0,%edi
    1039: setg   %al
    103c: pop    %rbp
    103d: retq`
    },
    addresses: {
      old: `Function at 0x1000: call 0x1050
Function at 0x1010: call 0x1050
Function at 0x1020: call 0x1050
Function at 0x1030: call 0x1050
Function at 0x1040: call 0x1050
Target at 0x1050: ret
Data: 0x1050 0x1050 0x1050`,
      new: `Function at 0x1000: call 0x1054
Function at 0x1010: call 0x1054
Function at 0x1020: call 0x1054
Function at 0x1030: call 0x1054
Function at 0x1040: call 0x1054
Inserted at 0x1050: nop nop nop nop
Target at 0x1054: ret
Data: 0x1054 0x1054 0x1054`
    }
  };

  const example = examples[type];
  if (example) {
    document.getElementById('oldText').value = example.old;
    document.getElementById('newText').value = example.new;
    runBsdiff();
  }
}
